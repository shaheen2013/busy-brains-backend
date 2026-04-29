import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import mjml2html from "mjml";
import { AppConfig } from "../../config/app.config";
import { EmailTemplateMap } from "./types";
import { templateRegistry } from "./registry";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    const { host, port, user, pass } = this.configService.get("email", {
      infer: true,
    });
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  }

  async send<T extends keyof EmailTemplateMap>(params: {
    to: string;
    template: T;
    data: EmailTemplateMap[T];
  }) {
    const template = templateRegistry[params.template];

    if (!template) {
      throw new Error(`Template not found: ${params.template}`);
    }

    const mjml = template.render(params.data);
    const { html, errors } = await mjml2html(mjml);

    if (errors.length) {
      throw new Error(
        `MJML rendering error: ${errors.map((e) => e.formattedMessage).join("; ")}`,
      );
    }

    const { from } = this.configService.get("email", { infer: true });

    await this.transporter.sendMail({
      from: `"Busybrains" <${from}>`,
      to: params.to,
      subject: template.subject(params.data),
      html,
    });
  }
}
