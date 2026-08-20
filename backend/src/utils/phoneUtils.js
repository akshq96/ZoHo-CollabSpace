// Normalizes phone number input into one canonical shape so the same number
// is never stored/queried in multiple inconsistent forms (e.g. "9876543210",
// "+919876543210", "91-9876543210" all referring to the same phone).
//
// Uses libphonenumber-js (Google's libphonenumber ported to JS) instead of
// regex-only validation — regex can't tell a plausible-length-but-invalid
// number (wrong area code, wrong length for that specific country) from a
// real one, which is exactly the kind of bug that makes "one number works,
// others don't" hard to diagnose from the frontend alone.
const { parsePhoneNumberFromString } = require('libphonenumber-js');

/**
 * @param {string} rawSuffix e.g. "+91", "91", " +91 "
 * @param {string} rawNumber e.g. "9876543210", "98765 43210", "098765-43210"
 * @returns {{ suffix: string, number: string, e164: string } | null} null if invalid
 */
function normalizePhone(rawSuffix, rawNumber) {
  if (!rawSuffix || !rawNumber) return null;

  const suffixDigits = String(rawSuffix).replace(/[^\d]/g, '');
  if (!suffixDigits || suffixDigits.length > 3) return null;
  const suffix = `+${suffixDigits}`;

  // Strip everything but digits, then drop a leading trunk "0" (common in
  // locally-formatted numbers like "09876543210").
  let number = String(rawNumber).replace(/[^\d]/g, '');
  if (number.startsWith('0') && number.length > 10) {
    number = number.replace(/^0+/, '');
  }

  if (number.length < 6 || number.length > 14) return null;

  const candidateE164 = `${suffix}${number}`;

  // Real validation: does libphonenumber recognize this as a plausible
  // number for its country (correct length/pattern for that calling code)?
  // Fall back to the regex-only result if the library can't parse it at all
  // (e.g. an obscure/unassigned calling code) rather than hard-blocking a
  // number a user might legitimately have.
  const parsed = parsePhoneNumberFromString(candidateE164);
  if (parsed) {
    if (!parsed.isValid()) return null;
    // parsed.number is the library's own canonical E.164 form — prefer it
    // (it corrects things like an accidental extra/missing digit the regex
    // pass wouldn't have caught) but keep suffix/number split for storage.
    const e164 = parsed.number;
    const countryCallingCode = `+${parsed.countryCallingCode}`;
    const nationalNumber = parsed.nationalNumber;
    return { suffix: countryCallingCode, number: nationalNumber, e164 };
  }

  return { suffix, number, e164: candidateE164 };
}

module.exports = { normalizePhone };
