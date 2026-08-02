// Payload thật từ SePay webhook (đã verify qua docs.sepay.vn) — vd:
// {"id":92704,"gateway":"Vietcombank","transactionDate":"2024-07-02 11:08:33",
//  "accountNumber":"1017588888","code":"SEVN63DC8E5C","content":"SEVN63DC8E5C chuyen tien",
//  "transferType":"in","transferAmount":5000000,"accumulated":105000000,"referenceCode":"FT24012345678"}
export interface SepayWebhookPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string;
  content?: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  accumulated?: number;
  referenceCode?: string;
}
