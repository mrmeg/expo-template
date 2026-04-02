# Ticket Management Features - Testing Guide

This document outlines step-by-step testing procedures for the ticket management features. Follow each section in order to verify functionality.

---

## Prerequisites

Before testing, ensure you have:
- A test event with ticketing enabled (at least one ticket type)
- Access to the event host account
- A secondary email address for receiving test emails
- The app running locally (`bun run dev:local`)

---

## 1. Real-time Door Sales

### Location
- API: `/app/api/events/[id]/instant-door-ticket+api.ts`
- UI: `/app/(app)/(drawer)/events/[id]/door-sales.tsx`

### Test Steps

#### 1.1 Access Door Sales Page
1. Navigate to `/events` (your events dashboard)
2. Click the "..." (more options) button on any event row
3. Select "Door Sales" from the dropdown menu
4. **Expected**: Page loads with ticket type dropdown and quantity selector

#### 1.2 Create Door Ticket (Basic)
1. Select a ticket type from dropdown
2. Set quantity to 1
3. Leave customer fields empty
4. Select payment method: "Cash"
5. Click "Create Ticket"
6. **Expected**:
   - Success notification appears
   - QR code displays immediately
   - Ticket code shown (format: TLO-XXXX-XXXX)
   - Ticket appears in "Recent Door Sales" list

#### 1.3 Create Door Ticket (With Customer Info)
1. Select a ticket type
2. Set quantity to 2
3. Enter customer name: "Test Customer"
4. Enter customer email: your secondary email
5. Select payment method: "External Card"
6. Add payment note: "Paid via Square"
7. Click "Create Ticket"
8. **Expected**:
   - 2 tickets created
   - QR codes display for both
   - Email received at secondary address with ticket details

#### 1.4 Edge Cases
- [ ] Try creating with quantity 0 → Should show error
- [ ] Try creating with quantity > 10 → Should show error
- [ ] Create ticket for sold-out ticket type → Should show error

---

## 2. Contact Ticket Holders via Email

### Location
- API: `/app/api/events/[id]/contact-attendees+api.ts`
- Modal: `/components/event/ContactAttendeesModal.tsx`
- Integration: `/app/(app)/(drawer)/events/[id]/attendees.tsx`

### Test Steps

#### 2.1 Individual Email
1. Navigate to event → Attendees tab
2. Find an attendee row and click the email icon
3. **Expected**: Email modal opens with recipient pre-filled
4. Enter subject: "Test Individual Email"
5. Enter message: "This is a test message for individual attendee."
6. Click "Send Email"
7. **Expected**:
   - Success notification
   - Modal closes
   - Email received at attendee's address

#### 2.2 Broadcast Email
1. On Attendees page, click "Email All" button in header
2. **Expected**: Modal opens in broadcast mode
3. Toggle filter to "Confirmed Only" if available
4. Enter subject: "Test Broadcast Email"
5. Enter message: "This is a broadcast to all attendees."
6. Click "Send to X Recipients"
7. **Expected**:
   - Confirmation prompt shows recipient count
   - Success notification after sending
   - Emails received by all matching attendees

#### 2.3 Edge Cases
- [ ] Send to event with 0 attendees → Should show appropriate message
- [ ] Send empty subject → Should show validation error
- [ ] Send empty message → Should show validation error
- [ ] Cancel mid-compose → Modal closes, no email sent

---

## 3. Ticket Transfers

### Location
- Initiate API: `/app/api/tickets/[id]/transfer+api.ts`
- Accept API: `/app/api/tickets/transfer/accept+api.ts`
- Cancel API: `/app/api/tickets/transfer/cancel+api.ts`
- Modal: `/components/tickets/TransferTicketModal.tsx`
- Accept Page: `/app/transfer/[token].tsx`

### Test Steps

#### 3.1 Initiate Transfer (as Ticket Holder)
1. Log in as a user who owns a ticket
2. Navigate to "My Tickets" or ticket details
3. Click "Transfer" on a confirmed ticket
4. **Expected**: Transfer modal opens
5. Enter recipient email: your secondary email
6. Enter recipient name: "Transfer Recipient"
7. Add note: "Enjoy the event!"
8. Click "Transfer Ticket"
9. **Expected**:
   - Success notification
   - Modal closes
   - Email sent to recipient with transfer link

#### 3.2 Accept Transfer
1. Check secondary email for transfer notification
2. Click the transfer link (format: `terlo.app/transfer/[token]`)
3. **Expected**: Transfer acceptance page loads showing:
   - Event details
   - Ticket type
   - Who sent the transfer
   - Email verification field
4. Enter the recipient email (must match `to_email`)
5. Click "Accept Transfer"
6. **Expected**:
   - Success message
   - Ticket now belongs to new owner
   - Both parties receive confirmation emails

#### 3.3 Cancel Transfer (Before Acceptance)
1. Initiate a new transfer as in 3.1
2. Before accepting, go back to ticket details as original owner
3. Click "Cancel Transfer" or access pending transfer
4. **Expected**:
   - Transfer cancelled
   - Recipient receives cancellation email
   - Ticket remains with original owner

#### 3.4 Host-Initiated Transfer
1. Log in as event host
2. Go to Attendees page
3. Find a ticket and click "Transfer" action
4. Complete transfer flow
5. **Expected**: Same as 3.1-3.2 but `initiated_by: "host"`

#### 3.5 Edge Cases
- [ ] Transfer to same email as current holder → Should show error
- [ ] Accept with wrong email → Should show "email doesn't match" error
- [ ] Accept expired transfer (after 48 hours) → Should show "expired" message
- [ ] Accept already-accepted transfer → Should show "already accepted" error
- [ ] Transfer non-confirmed ticket → Should show error
- [ ] Multiple pending transfers → Previous should auto-cancel

---

## 4. Comp Ticket System

### Location
- Create API: `/app/api/events/[id]/comp-tickets+api.ts`
- Redeem API: `/app/api/comp-tickets/redeem+api.ts`
- Distribution Claim API: `/app/api/comp-distributions/claim+api.ts`
- Claim Page: `/app/comp/claim/[code].tsx`

### Test Steps

#### 4.1 Individual Comp Ticket
1. Log in as event host
2. Navigate to event → Comp Tickets
3. Click "Create Comp Ticket"
4. Enter email: your secondary email
5. Select ticket type and quantity: 1
6. Add note: "VIP guest"
7. Click "Send Comp"
8. **Expected**:
   - Success notification
   - Email received with comp code (8 characters, e.g., "ABC12DEF")

#### 4.2 Redeem Individual Comp
1. From the comp email, note the comp code
2. Navigate to event page or redemption URL
3. Enter comp code
4. **Expected**:
   - Ticket redeemed successfully
   - QR code generated
   - Confirmation email with ticket details

#### 4.3 Distribution Mode
1. As event host, create comp ticket
2. Enable "Distribution Mode"
3. Set quantity: 5
4. Enter your email (distribution manager)
5. Click "Create Distribution"
6. **Expected**:
   - Success notification
   - Email received with distribution link: `terlo.app/comp/claim/[code]`
   - Shows "5 tickets to distribute"

#### 4.4 Claim from Distribution
1. Open the distribution link from 4.3
2. **Expected**: Claim page shows:
   - Event details
   - "5 tickets remaining"
   - Email input field
3. Enter a test email
4. Click "Claim My Free Ticket"
5. **Expected**:
   - Success page with QR code
   - "4 tickets remaining" now shown
   - Confirmation email sent

#### 4.5 Distribution Claim Limits
1. Using same distribution link, try claiming again with same email
2. **Expected**: Error "This email has already claimed a ticket"
3. Claim with different emails until all 5 are claimed
4. Try claiming with another new email
5. **Expected**: Error "All tickets from this distribution have been claimed"

#### 4.6 Revoke Unredeemed Comp
1. Create individual comp but don't redeem
2. As host, find the comp in Comp Tickets list
3. Click "Revoke" or delete action
4. **Expected**: Comp code invalidated
5. Try to redeem the revoked code
6. **Expected**: Error "Invalid comp code"

#### 4.7 Edge Cases
- [ ] Redeem same code twice → Should show "already redeemed" error
- [ ] Comp ticket for cancelled event → Should show error
- [ ] Invalid comp code format → Should show "not found" error

---

## 5. Scanner Verification

### Location
- API: `/app/api/tickets/verify+api.ts`
- UI: `/app/(app)/(drawer)/events/[id]/verify.tsx`

### Test Steps

#### 5.1 Manual Entry Verification
1. Log in as event host
2. Navigate to event → Verify/Scanner
3. Select "Manual Entry" mode
4. Enter a valid ticket code (from a purchased/comped ticket)
5. Click "Verify"
6. **Expected**:
   - Green success indicator
   - Shows: holder name, ticket type, "Scan 1 of 1"
   - Ticket appears in "Recent Verifications" list

#### 5.2 QR Code Scanning
1. On Verify page, select "Scan QR Code" mode
2. Allow camera permission if prompted
3. Point camera at a ticket QR code
4. **Expected**:
   - Auto-detects and verifies
   - Green overlay with "Valid Ticket!"
   - Success notification
   - Auto-resets for next scan after 4 seconds

#### 5.3 Verify Different Ticket Types

**Purchased Ticket:**
1. Scan a ticket purchased via Stripe
2. **Expected**: Valid, shows price paid

**Door Sale Ticket:**
1. Create a door ticket (Section 1)
2. Scan the door ticket QR
3. **Expected**: Valid, shows "Door Sale", status changes to "completed"

**Comp Ticket:**
1. Redeem a comp ticket (Section 4)
2. Scan the redeemed comp ticket
3. **Expected**: Valid, shows as comped ticket

**Transferred Ticket:**
1. Complete a transfer (Section 3)
2. Scan the transferred ticket
3. **Expected**: Valid, shows new holder name

#### 5.4 Already Verified Ticket
1. Scan a ticket that was already verified
2. **Expected**:
   - Red error indicator
   - "Already Used!" message
   - Shows previous verification count

#### 5.5 Invalid/Wrong Event Ticket
1. Try to scan a ticket from a different event
2. **Expected**: Error "You can only verify tickets for your own events"

#### 5.6 Edge Cases
- [ ] Scan non-ticket QR code → Should show "invalid QR" error
- [ ] Scan with camera flipped (front) → Should still work
- [ ] Enter invalid ticket code manually → Should show "not found"
- [ ] Rapid multiple scans of same ticket → Should prevent race condition

---

## Test Completion Checklist

### Door Sales
- [ ] Basic ticket creation works
- [ ] Customer info captured correctly
- [ ] Email receipt sent when email provided
- [ ] QR code displays and is scannable
- [ ] Recent sales list updates

### Contact Attendees
- [ ] Individual email sends correctly
- [ ] Broadcast email sends to all matching
- [ ] Filter options work (if implemented)
- [ ] Email content renders properly

### Ticket Transfers
- [ ] Holder can initiate transfer
- [ ] Host can initiate transfer
- [ ] Recipient can accept via link
- [ ] Email verification required
- [ ] Cancellation works
- [ ] 48-hour expiry enforced
- [ ] Both parties notified

### Comp Tickets
- [ ] Individual comp creation works
- [ ] Comp code redeemable
- [ ] Distribution mode creates shareable link
- [ ] Claim limit enforced
- [ ] Duplicate email prevention works
- [ ] Revocation invalidates code

### Scanner
- [ ] Manual entry verification works
- [ ] QR scanning works
- [ ] All ticket types verify correctly
- [ ] Already-used detection works
- [ ] Wrong event rejection works
- [ ] Continuous scanning mode works

---

## Reporting Issues

When reporting issues, include:
1. Feature being tested
2. Exact steps to reproduce
3. Expected vs actual behavior
4. Any error messages (check browser console)
5. Screenshots if applicable

Check server logs for API errors:
```bash
# If running locally, check terminal output
# Look for [ERROR] or stack traces
```
