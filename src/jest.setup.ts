import { Logger } from "@nestjs/common";
Logger.overrideLogger([]);
jest.spyOn(console, "error").mockImplementation(() => {});
