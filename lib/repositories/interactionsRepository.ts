import { SheetsRepository } from "./store";
import type { Interaction } from "../types";
export const interactionsRepository = (token: string) =>
  new SheetsRepository<Interaction>(token, "Interactions");
