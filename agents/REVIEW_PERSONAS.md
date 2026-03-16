# Review Personas

When running a review pass, adopt each persona below **one at a time**. Each persona reviews against the doc(s) they own. They should also flag when their owned docs need updates.

---

## 1. Designer

**Owns:** `./Docs/DESIGN.md`

**Focus:** User interface quality, design system consistency, visual hierarchy, spacing, typography, color usage, responsive behavior, and animation/transitions.

**Review questions:**
- Does this match established design patterns in DESIGN.md?
- Is the component hierarchy logical and reusable?
- Are edge cases handled visually (empty states, loading, errors, overflow text)?
- Would this confuse or frustrate a user on first encounter?
- Does DESIGN.md need to be updated to reflect new patterns introduced here?

---

## 2. Architect

**Owns:** `./Docs/ARCHITECTURE.md`

**Focus:** System design, separation of concerns, data flow, dependencies, scalability, and technical debt.

**Review questions:**
- Does this fit the existing architecture described in ARCHITECTURE.md?
- Are there any new dependencies, and are they justified?
- Is the data flow clear and predictable?
- Does this introduce tight coupling that will cause pain later?
- Are there simpler alternatives that achieve the same goal?
- Does ARCHITECTURE.md need to be updated?

---

## 3. Domain Expert

**Owns:** `./Docs/DOMAIN.md`

**Focus:** Business logic correctness, domain model integrity, invariant enforcement, and edge cases in business rules.

**Review questions:**
- Does this correctly implement the business rules in the spec?
- Are domain invariants (e.g., "an event must have a start date before end date") enforced?
- Are edge cases in the domain handled (e.g., timezone issues, currency, permissions)?
- Does this accidentally allow invalid states?
- Does DOMAIN.md need to be updated with new rules or entities?

---

## 4. Code Expert

**Owns:** `./Docs/API.md`

**Focus:** Code quality, readability, maintainability, error handling, type safety, naming, and adherence to project conventions.

**Review questions:**
- Is this code clear and readable without excessive comments?
- Are errors handled properly (no swallowed errors, meaningful messages)?
- Are types precise (no unnecessary `any`, proper null handling)?
- Does naming follow project conventions?
- Are there opportunities to reduce duplication?
- Is API.md accurate for any new or changed endpoints?

---

## 5. Performance Expert

**Owns:** `./Docs/PERFORMANCE.md`

**Focus:** Runtime performance, bundle size, memory usage, query efficiency, network calls, and rendering performance.

**Review questions:**
- Does this introduce unnecessary re-renders or expensive computations?
- Are database queries efficient? N+1 problems? Missing indexes?
- Does this affect bundle size meaningfully?
- Are there memory leaks (uncleaned listeners, timers, subscriptions)?
- Is caching used where appropriate?
- Does PERFORMANCE.md need to be updated with new benchmarks or known issues?

---

## 6. Human Advocate

**Owns:** `./Docs/USER_FLOWS.md`

**Focus:** User experience, accessibility, error messaging, onboarding friction, and whether the feature actually solves the user's problem.

**Review questions:**
- Does this feature solve the problem described in the spec from the USER's perspective?
- Is the happy path smooth and obvious?
- Are error messages helpful and actionable (not technical jargon)?
- Is this accessible (screen readers, keyboard navigation, color contrast)?
- What happens if the user does something unexpected?
- Does USER_FLOWS.md need a new or updated flow?

---

## How to Run a Review Pass

For each persona:

1. State: "Reviewing as [Persona Name]..."
2. Load and re-read the doc they own.
3. Evaluate the plan OR diff against the review questions above.
4. Output one of:
   - ✅ **GREEN** — No blocking concerns. (Optional: minor suggestions.)
   - ⚠️ **YELLOW** — Non-blocking concerns that should be addressed.
   - 🔴 **RED** — Blocking concern. Must be resolved before proceeding.
5. If the persona's owned doc needs updates, note specifically what should change.

**All 6 personas must be GREEN or YELLOW to proceed.** Any RED requires a fix and re-review.
