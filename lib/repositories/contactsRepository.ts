import { SheetsRepository } from "./store";
import type { Contact } from "../types";
export const contactsRepository = (token: string) =>
  new SheetsRepository<Contact>(token, "Contacts");
