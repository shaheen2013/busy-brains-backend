import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { In, Repository } from "typeorm";
import Stripe from "stripe";
import { AppConfig } from "../../config/app.config";
import { User } from "../users/entities/user.entity";
import {
  WeeklySubscription,
  WeeklySubscriptionStatus,
} from "../subscriptions/entities/weekly-subscription.entity";
import {
  WeeklyPaymentHistory,
  WeeklyPaymentStatus,
} from "../subscriptions/entities/weekly-payment-history.entity";

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

@Injectable()
export class PaymentMethodService {
  private stripe: Stripe.Stripe;
  private logger = new Logger(PaymentMethodService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WeeklySubscription)
    private readonly weeklySubscriptionRepository: Repository<WeeklySubscription>,
    @InjectRepository(WeeklyPaymentHistory)
    private readonly weeklyPaymentHistoryRepository: Repository<WeeklyPaymentHistory>,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    const { secretKey } = this.configService.get("stripe", { infer: true });
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
  }

  private async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    user.stripeCustomerId = customer.id;
    await this.userRepository.save(user);
    return customer.id;
  }

  async getCurrent(user: User): Promise<PaymentMethodInfo | null> {
    if (
      user.cardBrand &&
      user.cardLast4 &&
      user.cardExpMonth &&
      user.cardExpYear
    ) {
      return {
        brand: user.cardBrand,
        last4: user.cardLast4,
        expMonth: user.cardExpMonth,
        expYear: user.cardExpYear,
      };
    }

    if (!user.stripeCustomerId) return null;

    const customer = (await this.stripe.customers.retrieve(
      user.stripeCustomerId,
      {
        expand: ["invoice_settings.default_payment_method"],
      },
    )) as any;
    if (customer?.deleted) return null;

    const pm = customer?.invoice_settings?.default_payment_method;
    if (!pm || typeof pm === "string" || !pm.card) return null;

    await this.persistCard(user, pm);

    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  }

  private async persistCard(user: User, pm: any): Promise<void> {
    if (!pm.card) return;
    user.paymentMethodId = pm.id;
    user.cardBrand = pm.card.brand;
    user.cardLast4 = pm.card.last4;
    user.cardExpMonth = pm.card.exp_month;
    user.cardExpYear = pm.card.exp_year;
    await this.userRepository.save(user);
  }

  async update(
    user: User,
    paymentMethodId: string,
  ): Promise<
    PaymentMethodInfo & {
      retriedPayments: { weeklyPaymentHistoryId: string; status: string }[];
    }
  > {
    const stripeCustomerId = await this.ensureStripeCustomer(user);

    const pm = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });
    await this.stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const activeSub = await this.weeklySubscriptionRepository.findOne({
      where: {
        userId: user.id,
        status: In([
          WeeklySubscriptionStatus.ACTIVE,
          WeeklySubscriptionStatus.PAST_DUE,
        ]),
      },
    });
    if (activeSub) {
      await this.stripe.subscriptions.update(activeSub.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }

    await this.persistCard(user, pm);

    const retriedPayments = await this.retryFailed(user);

    if (!pm.card)
      throw new BadRequestException(
        "Attached payment method has no card details",
      );
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      retriedPayments,
    };
  }

  async remove(user: User): Promise<{ success: boolean }> {
    if (!user.stripeCustomerId || !user.paymentMethodId) {
      return { success: true };
    }

    try {
      await this.stripe.paymentMethods.detach(user.paymentMethodId);
    } catch (err) {
      this.logger.warn(
        `Failed to detach payment method ${user.paymentMethodId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    user.paymentMethodId = null;
    user.cardBrand = null;
    user.cardLast4 = null;
    user.cardExpMonth = null;
    user.cardExpYear = null;
    await this.userRepository.save(user);

    return { success: true };
  }

  async retryFailed(
    user: User,
  ): Promise<{ weeklyPaymentHistoryId: string; status: string }[]> {
    const activeSub = await this.weeklySubscriptionRepository.findOne({
      where: {
        userId: user.id,
        status: In([
          WeeklySubscriptionStatus.ACTIVE,
          WeeklySubscriptionStatus.PAST_DUE,
        ]),
      },
    });
    if (!activeSub) return [];

    const failed = await this.weeklyPaymentHistoryRepository.find({
      where: {
        weeklySubscriptionId: activeSub.id,
        status: WeeklyPaymentStatus.FAILED,
      },
      order: { createdAt: "DESC" },
    });

    const results: { weeklyPaymentHistoryId: string; status: string }[] = [];
    for (const record of failed) {
      if (!record.stripeInvoiceId) continue;
      try {
        await this.stripe.invoices.pay(record.stripeInvoiceId);
        results.push({
          weeklyPaymentHistoryId: record.id,
          status: "succeeded",
        });
      } catch (err) {
        this.logger.warn(
          `Retry failed for invoice ${record.stripeInvoiceId}: ${err instanceof Error ? err.message : err}`,
        );
        results.push({ weeklyPaymentHistoryId: record.id, status: "failed" });
      }
    }
    return results;
  }
}
