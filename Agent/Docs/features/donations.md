# Donation Feature - Implementation Guide

> **Status**: NOT YET IMPLEMENTED
> This document serves as an implementation guide for when this feature is revisited.

## Overview

The donation feature allows event organizers to accept donations from supporters. There are two ways donations can be made:

1. **Standalone Donations** - A "Support This Event" card on the event page for people who can't attend but want to contribute
2. **Checkout Add-on** - An optional donation during ticket purchase

---

## Fee Structure

### Platform Fee: $0

Terlo takes **no platform fee** on donations. This is a goodwill gesture for nonprofits.

### Processing Fee: Stripe's Standard Rate

Donors pay Stripe's processing fee: **2.9% + $0.30**

### Fee Examples

| Donation Amount | Processing Fee | Total Charged | Organizer Receives |
|-----------------|----------------|---------------|-------------------|
| $25.00 | $1.03 | $26.03 | $25.00 |
| $50.00 | $1.75 | $51.75 | $50.00 |
| $100.00 | $3.20 | $103.20 | $100.00 |
| $10.00 | $0.59 | $10.59 | $10.00 |

**Key point:** 100% of the donation amount goes to the organizer. The donor covers the Stripe processing fee.

---

## Implementation Steps

### Step 1: Database Schema

Run the following SQL to create the donations table and add columns to events:

```sql
-- Add donation columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS donations_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS donation_message TEXT,
ADD COLUMN IF NOT EXISTS suggested_donation_amounts JSONB DEFAULT '[2500, 5000, 10000]';

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID,
  donor_email TEXT NOT NULL,
  donor_name TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  donation_type TEXT NOT NULL DEFAULT 'standalone',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_donations_event_id ON donations(event_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email);
```

**Note:** The `user_id` column does NOT have a foreign key to `auth.users` because foreign keys to Supabase auth tables require special handling. The app validates user IDs through the authentication layer instead.

### Step 2: Update Drizzle Schema

Add to `drizzle/schema.ts`:

```typescript
// Add to events table
donationsEnabled: boolean("donations_enabled").default(false),
donationMessage: text("donation_message"),
suggestedDonationAmounts: jsonb("suggested_donation_amounts").default([2500, 5000, 10000]),

// New donations table
export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  donorEmail: text("donor_email").notNull(),
  donorName: text("donor_name"),
  isAnonymous: boolean("is_anonymous").default(false),
  amountCents: integer("amount_cents").notNull(),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  donationType: text("donation_type").notNull().default("standalone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});
```

Add to `drizzle/relations.ts`:

```typescript
export const donationsRelations = relations(donations, ({ one }) => ({
  event: one(events, {
    fields: [donations.eventId],
    references: [events.id],
  }),
}));

// Add to eventsRelations:
donations: many(donations),
```

### Step 3: Add Fee Calculators

Add to `server/stripe/config.ts`:

```typescript
export const DONATION_FEES = {
  PLATFORM_FEE_PERCENT: 0,
  STRIPE_PERCENT: 2.9,
  STRIPE_FIXED_CENTS: 30,
  MIN_DONATION_CENTS: 100,
  MAX_DONATION_CENTS: 100000,
  DEFAULT_SUGGESTED_AMOUNTS: [2500, 5000, 10000] as const,
} as const;

export const DonationFeeCalculators = {
  calculateProcessingFee(donationAmountCents: number): number {
    const percentageFee = Math.round(donationAmountCents * (DONATION_FEES.STRIPE_PERCENT / 100));
    return percentageFee + DONATION_FEES.STRIPE_FIXED_CENTS;
  },

  calculateTotalCharge(donationAmountCents: number): number {
    const processingFee = this.calculateProcessingFee(donationAmountCents);
    return donationAmountCents + processingFee;
  },

  getOrganizerAmount(donationAmountCents: number): number {
    return donationAmountCents;
  },

  formatDonationBreakdown(donationAmountCents: number) {
    const processingFee = this.calculateProcessingFee(donationAmountCents);
    const totalCharge = this.calculateTotalCharge(donationAmountCents);
    const organizerReceives = this.getOrganizerAmount(donationAmountCents);

    return {
      donationAmount: donationAmountCents,
      processingFee,
      totalCharge,
      organizerReceives,
      formatted: {
        donationAmount: `$${(donationAmountCents / 100).toFixed(2)}`,
        processingFee: `$${(processingFee / 100).toFixed(2)}`,
        totalCharge: `$${(totalCharge / 100).toFixed(2)}`,
        organizerReceives: `$${(organizerReceives / 100).toFixed(2)}`,
      },
    };
  },
};
```

### Step 4: Create API Endpoints

#### `/app/api/donations/create+api.ts`

```typescript
import { ExpoRequest, ExpoResponse } from "expo-router/server";
import { db } from "@/lib/db";
import { donations, events, stripeAccounts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { DonationFeeCalculators, DONATION_FEES } from "@/server/stripe/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    const body = await request.json();
    const {
      eventId,
      amount,
      donorEmail,
      donorName,
      isAnonymous,
      message,
      paymentMethod,
    } = body;

    // Validation
    if (!eventId || !amount || !donorEmail) {
      return new ExpoResponse(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    if (amount < DONATION_FEES.MIN_DONATION_CENTS || amount > DONATION_FEES.MAX_DONATION_CENTS) {
      return new ExpoResponse(
        JSON.stringify({ error: "Invalid donation amount" }),
        { status: 400 }
      );
    }

    // Get event and verify donations are enabled
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return new ExpoResponse(
        JSON.stringify({ error: "Event not found" }),
        { status: 404 }
      );
    }

    if (!event.donationsEnabled) {
      return new ExpoResponse(
        JSON.stringify({ error: "Donations are not enabled for this event" }),
        { status: 400 }
      );
    }

    // Get organizer's Stripe account
    const [stripeAccount] = await db
      .select()
      .from(stripeAccounts)
      .where(eq(stripeAccounts.userId, event.userId))
      .limit(1);

    if (!stripeAccount?.stripeAccountId) {
      return new ExpoResponse(
        JSON.stringify({ error: "Organizer has not connected Stripe" }),
        { status: 400 }
      );
    }

    // Calculate fees
    const processingFee = DonationFeeCalculators.calculateProcessingFee(amount);
    const totalCharge = DonationFeeCalculators.calculateTotalCharge(amount);

    // Create donation record
    const [donation] = await db
      .insert(donations)
      .values({
        eventId,
        donorEmail,
        donorName: donorName || null,
        isAnonymous: isAnonymous || false,
        amountCents: amount,
        message: message || null,
        donationType: "standalone",
        status: "pending",
      })
      .returning();

    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "http://localhost:8081";

    if (paymentMethod === "mobile") {
      // Create Payment Intent for mobile
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCharge,
        currency: "usd",
        transfer_data: {
          destination: stripeAccount.stripeAccountId,
        },
        metadata: {
          donation_id: donation.id.toString(),
          event_id: eventId.toString(),
          donation_amount: amount.toString(),
          processing_fee: processingFee.toString(),
          donor_email: donorEmail,
        },
      });

      await db
        .update(donations)
        .set({ stripePaymentIntentId: paymentIntent.id })
        .where(eq(donations.id, donation.id));

      return new ExpoResponse(
        JSON.stringify({
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount,
          processingFee,
          totalCharge,
        }),
        { status: 200 }
      );
    }

    // Create Checkout Session for web
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: donorEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Donation to ${event.title}`,
              description: "100% goes directly to the organizer",
            },
            unit_amount: totalCharge,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: {
          destination: stripeAccount.stripeAccountId,
        },
        metadata: {
          donation_id: donation.id.toString(),
          event_id: eventId.toString(),
          donation_amount: amount.toString(),
          processing_fee: processingFee.toString(),
        },
      },
      success_url: `${baseUrl}/api/donations/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/event/${eventId}`,
      metadata: {
        donation_id: donation.id.toString(),
        event_id: eventId.toString(),
      },
    });

    await db
      .update(donations)
      .set({ stripeSessionId: session.id })
      .where(eq(donations.id, donation.id));

    return new ExpoResponse(
      JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        amount,
        processingFee,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Donation creation error:", error);
    return new ExpoResponse(
      JSON.stringify({ error: "Failed to create donation" }),
      { status: 500 }
    );
  }
}
```

#### `/app/api/donations/success+api.ts`

```typescript
import { ExpoRequest, ExpoResponse } from "expo-router/server";
import { db } from "@/lib/db";
import { donations, events, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { sendEmail } from "@/server/email/sender";
import {
  generateDonationReceiptEmail,
  generateDonationNotificationEmail,
} from "@/server/email/templates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return ExpoResponse.redirect("/");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const donationId = session.metadata?.donation_id;

    if (!donationId) {
      return ExpoResponse.redirect("/");
    }

    // Update donation status
    const [donation] = await db
      .update(donations)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        stripePaymentIntentId: session.payment_intent as string,
      })
      .where(eq(donations.id, parseInt(donationId)))
      .returning();

    // Get event and organizer details
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, donation.eventId))
      .limit(1);

    const [organizer] = await db
      .select()
      .from(users)
      .where(eq(users.id, event.userId))
      .limit(1);

    // Send emails
    const donorName = donation.isAnonymous
      ? "Anonymous Donor"
      : donation.donorName || "A supporter";

    // Receipt to donor
    await sendEmail({
      to: donation.donorEmail,
      subject: `Thank you for your donation to ${event.title}`,
      html: generateDonationReceiptEmail({
        eventTitle: event.title,
        donationAmount: donation.amountCents,
        donorName: donation.donorName || "Supporter",
        organizerName: organizer?.name || "Event Organizer",
        transactionId: donation.stripePaymentIntentId || donation.id.toString(),
        date: new Date(),
      }),
    });

    // Notification to organizer
    if (organizer?.email) {
      await sendEmail({
        to: organizer.email,
        subject: `New donation received for ${event.title}`,
        html: generateDonationNotificationEmail({
          eventTitle: event.title,
          donationAmount: donation.amountCents,
          donorName,
          donorMessage: donation.message,
          isAnonymous: donation.isAnonymous || false,
        }),
      });
    }

    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "http://localhost:8081";
    return ExpoResponse.redirect(
      `${baseUrl}/event/${donation.eventId}?donation=success`
    );
  } catch (error) {
    console.error("Donation success error:", error);
    return ExpoResponse.redirect("/");
  }
}
```

### Step 5: Add Email Templates

Add to `server/email/templates.ts`:

```typescript
export function generateDonationReceiptEmail(params: {
  eventTitle: string;
  donationAmount: number;
  donorName: string;
  organizerName: string;
  transactionId: string;
  date: Date;
}): string {
  const formattedAmount = `$${(params.donationAmount / 100).toFixed(2)}`;
  const formattedDate = params.date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Thank You for Your Donation!</h1>

      <p>Dear ${params.donorName},</p>

      <p>Thank you for your generous donation of <strong>${formattedAmount}</strong> to support <strong>${params.eventTitle}</strong>.</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Donation Receipt</h3>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Event:</strong> ${params.eventTitle}</p>
        <p><strong>Organizer:</strong> ${params.organizerName}</p>
        <p><strong>Transaction ID:</strong> ${params.transactionId}</p>
      </div>

      <p style="font-size: 12px; color: #666;">
        This receipt may be used for tax purposes. Please consult your tax advisor regarding the deductibility of this donation.
      </p>

      <p>With gratitude,<br/>The ${params.organizerName} Team</p>
    </div>
  `;
}

export function generateDonationNotificationEmail(params: {
  eventTitle: string;
  donationAmount: number;
  donorName: string;
  donorMessage?: string | null;
  isAnonymous: boolean;
}): string {
  const formattedAmount = `$${(params.donationAmount / 100).toFixed(2)}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">New Donation Received!</h1>

      <p>Great news! You've received a donation for <strong>${params.eventTitle}</strong>.</p>

      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2e7d32;">Donation Details</h3>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        <p><strong>From:</strong> ${params.isAnonymous ? "Anonymous Donor" : params.donorName}</p>
        ${params.donorMessage ? `<p><strong>Message:</strong> "${params.donorMessage}"</p>` : ""}
      </div>

      <p>The full donation amount has been transferred to your Stripe account.</p>
    </div>
  `;
}
```

### Step 6: Update Event Form Types

Add to `components/event/form/types.ts`:

```typescript
// Add to EventFormData interface:
donationsEnabled?: boolean;
donationMessage?: string;
suggestedDonationAmounts?: number[];
```

### Step 7: Update Form Utils

Add transformation in `components/event/form/formUtils.ts`:

```typescript
// In transformFormDataForApi():
donationsEnabled: formData.donationsEnabled || false,
donationMessage: formData.donationMessage || null,
suggestedDonationAmounts: formData.suggestedDonationAmounts || [2500, 5000, 10000],
```

### Step 8: Create UI Components

Create these files in `components/donations/`:

1. **DonationCard.tsx** - Card displayed on event page
2. **DonationModal.tsx** - Full donation flow with form
3. **DonationAmountSelector.tsx** - Preset amount buttons
4. **DonationCheckoutAddon.tsx** - Collapsible add-on for ticket checkout

See the `DonationCheckoutAddon.tsx` that was built as a reference for the styling pattern.

### Step 9: Update Event Form

Add donation configuration section to `TicketingFields.tsx`:

```typescript
{hasStripeAccount && (
  <View>
    <SwitchField
      label="Accept Donations"
      value={donationsEnabled}
      onValueChange={setDonationsEnabled}
    />
    {donationsEnabled && (
      <>
        <TextField
          label="Donation Message (optional)"
          value={donationMessage}
          onChangeText={setDonationMessage}
          placeholder="Help support our cause..."
          multiline
        />
        {/* Suggested amounts configuration */}
      </>
    )}
  </View>
)}
```

### Step 10: Update Event Page

Add to `app/event/[id]/index.tsx`:

```typescript
{event.donationsEnabled && !isPastEvent && (
  <DonationCard
    event={event}
    onDonatePress={() => setShowDonationModal(true)}
  />
)}

<DonationModal
  visible={showDonationModal}
  onClose={() => setShowDonationModal(false)}
  event={event}
  suggestedAmounts={event.suggestedDonationAmounts}
/>
```

### Step 11: Update Ticket Purchase Modal

Add `DonationCheckoutAddon` to the checkout flow in `TicketPurchaseModal.tsx`:

```typescript
{event.donationsEnabled && (
  <DonationCheckoutAddon
    suggestedAmounts={event.suggestedDonationAmounts}
    selectedDonation={selectedDonation}
    onDonationChange={setSelectedDonation}
  />
)}
```

---

## Files to Create/Modify

| Purpose | File |
|---------|------|
| Fee calculators | `/server/stripe/config.ts` (modify) |
| Create donation API | `/app/api/donations/create+api.ts` (create) |
| Success handler | `/app/api/donations/success+api.ts` (create) |
| Email templates | `/server/email/templates.ts` (modify) |
| Donation card UI | `/components/donations/DonationCard.tsx` (create) |
| Donation modal | `/components/donations/DonationModal.tsx` (create) |
| Amount selector | `/components/donations/DonationAmountSelector.tsx` (create) |
| Checkout add-on | `/components/donations/DonationCheckoutAddon.tsx` (create) |
| Form types | `/components/event/form/types.ts` (modify) |
| Form utils | `/components/event/form/formUtils.ts` (modify) |
| Form config | `/components/event/form/TicketingFields.tsx` (modify) |
| Event page | `/app/event/[id]/index.tsx` (modify) |
| Ticket modal | `/components/tickets/TicketPurchaseModal.tsx` (modify) |
| Event APIs | `/app/api/events/index+api.ts` and `update+api.ts` (modify) |
| Drizzle schema | `/drizzle/schema.ts` (modify) |
| Drizzle relations | `/drizzle/relations.ts` (modify) |

---

## Architecture Decisions

1. **No platform fee on donations** - Goodwill gesture for nonprofits
2. **Donor pays processing fee** - Ensures 100% goes to organizer
3. **No foreign key to auth.users** - Supabase auth tables require special handling
4. **Stripe Connect direct charges** - Funds go directly to organizer's account
5. **Both web (Checkout Sessions) and mobile (Payment Intents) flows** - Cross-platform support
6. **Anonymous option** - Donors can hide their name from organizers
7. **Checkout add-on is collapsible** - Non-intrusive during ticket purchase

---

## Testing Checklist

- [ ] Create event with donations enabled
- [ ] Verify donation card appears on event page
- [ ] Test standalone donation flow (web)
- [ ] Test standalone donation flow (mobile)
- [ ] Test checkout add-on during ticket purchase
- [ ] Verify donor receives receipt email
- [ ] Verify organizer receives notification email
- [ ] Check Stripe dashboard for correct transfers
- [ ] Test anonymous donation
- [ ] Test custom donation amount
- [ ] Verify donation records in database
