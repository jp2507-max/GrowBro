export class ConsentRequiredError extends Error {
  code: 'CONSENT_REQUIRED';
  purpose?: string;

  constructor(message: string, purpose?: string) {
    super(message);
    this.name = 'ConsentRequiredError';
    this.code = 'CONSENT_REQUIRED';
    this.purpose = purpose;
  }
}
