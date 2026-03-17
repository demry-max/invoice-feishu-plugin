import type { BankAccount } from "../types";

/** 预设银行账户列表 */
export const DEFAULT_BANK_ACCOUNTS: readonly BankAccount[] = [
  // ── 菲龙咨询 ──
  {
    id: "feilong-minsheng",
    label: "菲龙咨询-民生银行(RMB)",
    account_name: "菲龙咨询服务（深圳）有限公司",
    account_number: "641971264",
    bank_name: "民生银行",
    bank_address: "深圳市福田区福中三路和海田路交汇处民生金融大厦 1 层",
    swift_code: "MSBCCNBJ004",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "RMB",
  },
  {
    id: "feilong-jiaotong",
    label: "菲龙咨询-交通银行(RMB)",
    account_name: "菲龙咨询服务（深圳）有限公司",
    account_number: "443066467013008120712",
    bank_name: "交通银行",
    bank_address: "交通银行华融支行",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "RMB",
  },
  {
    id: "feilong-alipay",
    label: "菲龙咨询-企业支付宝(RMB)",
    account_name: "菲龙咨询服务（深圳）有限公司",
    account_number: "carry@feilong-consult.com",
    bank_name: "企业支付宝",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "RMB",
  },
  {
    id: "feilong-commercial-minsheng",
    label: "菲龙商业-民生银行(RMB)",
    account_name: "菲龙商业服务（深圳）有限公司",
    account_number: "650356120",
    bank_name: "民生银行",
    bank_address: "深圳市福田区福中三路和海田路交汇处民生金融大厦 1 层",
    swift_code: "MSBCCNBJ004",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "RMB",
  },
  {
    id: "feilong-commercial-alipay",
    label: "菲龙商业-企业支付宝(RMB)",
    account_name: "菲龙商业服务（深圳）有限公司",
    account_number: "1@totnt.com",
    bank_name: "企业支付宝",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "RMB",
  },
  {
    id: "starlight-bdo-php",
    label: "Starlight-BDO Unibank(PHP)",
    account_name: "STARLIGHT BUSINESS CONSULTING SERVICES INC.",
    account_number: "005398022599",
    bank_name: "BDO Unibank Inc",
    swift_code: "BNORPHMMXXX",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "PHP",
  },
  {
    id: "starlight-bdo-usd",
    label: "Starlight-BDO Unibank(USD)",
    account_name: "STARLIGHT BUSINESS CONSULTING SERVICES INC.",
    account_number: "111490029697",
    bank_name: "BDO Unibank Inc",
    swift_code: "BNORPHMMXXX",
    payment_title: "Please Deposit Payment to the Following Bank Account",
    currency_label: "USD",
  },
] as const;

/** 根据 ID 查找银行账户 */
export function findBankAccount(id: string): BankAccount | undefined {
  return DEFAULT_BANK_ACCOUNTS.find((b) => b.id === id);
}

/** 获取默认银行账户（第一个） */
export function getDefaultBankAccount(): BankAccount {
  return { ...DEFAULT_BANK_ACCOUNTS[0] };
}

/** 获取所有银行账户（副本） */
export function getAllBankAccounts(): BankAccount[] {
  return DEFAULT_BANK_ACCOUNTS.map((b) => ({ ...b }));
}
