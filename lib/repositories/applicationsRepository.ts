import { SheetsRepository } from "./store";
import type { Application } from "../types";
export const applicationsRepository = (token: string) =>
  new SheetsRepository<Application>(token, "Applications");
