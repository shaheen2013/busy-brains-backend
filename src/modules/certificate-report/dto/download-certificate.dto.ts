import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class DownloadCertificateDto {
  @ApiProperty({
    description:
      "Fully self-contained HTML (inline styles, inlined image data URIs) of the certificate, captured client-side, to be rendered to PDF.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5_000_000)
  html: string;
}
