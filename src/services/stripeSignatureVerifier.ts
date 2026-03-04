import Stripe from "stripe";

export class StripeSignatureVerifier {
  private readonly stripe: Stripe;

  public constructor(private readonly webhookSecret: string, apiKey: string) {
    this.stripe = new Stripe(apiKey);
  }

  public verifyAndConstructEvent(rawPayload: Buffer, signatureHeader: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawPayload, signatureHeader, this.webhookSecret);
  }

  public generateTestSignatureHeader(payload: string, timestamp?: number): string {
    return this.stripe.webhooks.generateTestHeaderString({
      payload,
      secret: this.webhookSecret,
      ...(timestamp ? { timestamp } : {})
    });
  }
}
