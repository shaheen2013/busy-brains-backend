import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { SsoService } from "./sso.service";
import { ExchangeSsoDto } from "./dto/exchange-sso.dto";

@Controller("sso")
export class SsoController {
  constructor(private ssoService: SsoService) {}

  @Public()
  @Post("exchange")
  async exchange(@Body() dto: ExchangeSsoDto) {
    return this.ssoService.exchangeForSignInTicket(dto.token);
  }
}
