import mongoose from 'mongoose';
import crypto from 'crypto';

const { Schema } = mongoose;
const ENCRYPTION_KEY = process.env.BANK_ENCRYPTION_KEY; // Must be 32 bytes
const IV_LENGTH = 16;

// Standard AES-256-CBC Encryption for Bank Accounts
function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const partnerBankAccountSchema = new Schema(
  {
    partnerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    partnerType: { type: String, required: true },
    
    accountHolderName: { type: String, required: true, trim: true },
    
    // Encrypted storage, only exposed via getters when explicitly needed
    encryptedAccountNumber: { 
      type: String, 
      required: true, 
      set: encrypt, 
      get: decrypt,
      select: false // Never pull by default
    },
    accountLast4: { type: String, required: true, maxlength: 4 },
    ifscCode: { type: String, required: true, uppercase: true, trim: true },
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
    upiId: { type: String, trim: true },
    
    isPrimary: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false },
    verificationMethod: { type: String, enum: ['penny_drop', 'manual', 'document'], default: 'manual' },
    verifiedAt: { type: Date },
    
    // RazorpayX Integrations
    razorpayContactId: { type: String, index: true },      // cont_xxx
    razorpayFundAccountId: { type: String, index: true },  // fa_xxx
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// Ensure only one primary account per user
partnerBankAccountSchema.pre('save', async function () {
  if (this.isPrimary) {
    await this.constructor.updateMany(
      { partnerUserId: this.partnerUserId, _id: { $ne: this._id } },
      { $set: { isPrimary: false } }
    );
  }
  
  if (this.isModified('encryptedAccountNumber')) {
    // We decrypt temporarily inside the hook to extract the last 4 digits securely
    const rawAccount = decrypt(this.encryptedAccountNumber);
    this.accountLast4 = rawAccount.slice(-4);
  }
 
});

const PartnerBankAccount = mongoose.model('PartnerBankAccount', partnerBankAccountSchema);
export default PartnerBankAccount;