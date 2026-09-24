# Frontend Master Prompt — European Wetland Restoration Platform

> Supplied by the client. Source of truth for all frontend/design work.
> Companion to `concept-note-2026-09-22.txt` (product source of truth).

You are a senior product designer and frontend engineer.

Build the frontend for a professional platform for European wetland restoration projects.

Users: project owners, large corporate buyers, banks and investment funds, auditors, platform administrators.

This is NOT an environmental NGO website. NOT a generic SaaS dashboard. NOT a crypto/credit-trading interface. NOT a real-estate website.

Think of the product as: **"A serious project marketplace + environmental due-diligence interface + private deal room."**

The interface should make a finance professional, sustainability manager, investor, or project owner feel that the information is trustworthy, structured, and easy to verify.

## 1. Core design philosophy

**CLARITY OVER MARKETING.**

Opening a project page must immediately answer:
1. What is the project? 2. Where is it? 3. What is being restored? 4. What environmental outcomes are expected? 5. How are those outcomes measured? 6. Who verifies them? 7. Who owns/develops the project? 8. What can be claimed? 9. What units are expected? 10. What units are committed? 11. What remains available? 12. What is the project asking for? 13. What can I do next?

Feel closer to: an institutional investment platform, a high-quality research/data platform, a professional project marketplace, a modern document management system.
Not: an environmental campaign website, a consumer marketplace, a flashy startup landing page.

## 2. Visual direction

Communicate: trust, nature, evidence, transparency, European institutional quality, professionalism, calm, precision.

Restrained visual system. Avoid visual noise, excessive animation, excessive rounded cards, giant decorative illustrations, generic stock photography, greenwashing aesthetics.

Do NOT cover the interface with leaves, trees, mountains, generic wetland photos, environmental slogans, giant nature backgrounds.

Communicate environmental impact through DATA and EVIDENCE, not marketing imagery.

## 3. Color system

- **Primary** — deep forest / dark green: primary actions, important highlights, selected states.
- **Secondary** — muted blue / water tone: water-related information, map elements, secondary highlights.
- **Neutral** — warm off-white / very light gray background.
- **Text** — very dark charcoal.
- **Borders** — soft neutral gray.
- **Success** — muted green. **Warning** — muted amber. **Error** — muted red.

No neon green. Do not make everything green. Colour carries meaning: water → blue, biodiversity → green, financial → neutral, warning → amber, error → red.

## 4. Typography

One primary typeface. Editorial, professional, readable, analytical.

Hierarchy — Large: project name, major section headings. Medium: section titles. Small: metadata, sources, dates, labels.

Numbers highly readable; important numbers get strong hierarchy:

```
EXPECTED ISSUANCE   12,400 units
COMMITTED            4,800 units
REMAINING            7,600 units
```

Do not turn every number into a giant dashboard KPI.

## 5. Layout

Generous whitespace. Structured grid. Prefer wide content areas, strong left alignment, clear section separation, readable tables, maps, timelines, document lists.

Avoid overly dense dashboards, tiny text, excessive card nesting, endless horizontal carousels. Calm and deliberate.

## 6. Global navigation

Desktop: Logo | Projects | How it works | For Buyers | For Investors | About — right: Sign in, Register.

Authenticated: Projects, My Sites, My Interests, Deals, Documents, Organization, Profile. Administrators additionally: Admin.

Clean header. Keep navigation simple.

## 7. Public landing page

Must not feel like a generic startup landing page.

Hero headline direction: "Discover and finance wetland restoration projects across Europe."
Supporting: "Explore project evidence, environmental outcomes, available units and financing opportunities in one place."
Primary CTA "Explore projects"; secondary "How it works".

Do NOT make exaggerated environmental claims.

## 8. Landing page sections

1. **Hero** — simple. Headline, short explanation, two CTAs, subtle map/environmental visual. No huge nature photograph.
2. **What the platform does** — explain the process visually: PROJECT → EVIDENCE → INTEREST → DEAL → RESTORATION → VERIFIED RESULTS → UNITS. Simple horizontal/vertical flow.
3. **Project discovery** — 3–4 realistic example project cards: project name, location, project type, catchment, expected outcomes, expected units, availability, status. CTA "View project".
4. **Why project information matters** — the information users can evaluate: location, water outcomes, biodiversity, claim rights, durability, verification, documents, availability. Icons sparingly.
5. **For buyers** — companies can discover projects, evaluate evidence, register their own sites, and express interest. CTA "Explore projects".
6. **For investors** — investors can review approved project information and, where appropriate, access financial information about projects seeking financing. CTA "For investors".
7. **Trust / transparency** — independent verification, documented project information, permanent transaction records, official registry references. Do not claim the platform is the official credit registry.
8. **EU funding** — EU emblem, "Co-funded by the European Union", required disclaimer.

## 9. Project index

One of the most important screens. Design it like a professional project discovery platform.

Header "Restoration projects" + short description. Then search, filters, map/list toggle, project cards.

Filters: country, region, project type, catchment, environmental outcomes, availability, deal type, project status. **Do not invent filters that cannot be supported by the data.**

## 10. Project card

Project name, location, small map preview, project type, catchment, environmental outcomes, expected issuance, committed volume, available volume, deal types, project status, CTA "View project".

```
Mara Wetland Restoration
Northern Germany · Rhine catchment
Water + Biodiversity
Expected issuance 12,400 · Committed 4,800 · Available 7,600
Forward contract · Co-investment
[View project]
```

Dense enough to be useful, not overwhelming.

## 11. Project detail page

**THE MOST IMPORTANT PAGE IN THE ENTIRE PLATFORM.** Treat it like a professional due-diligence document.

Top: project name, location, project owner, status, verification status. Primary CTA "Express interest"; secondary "Download project documents". Then a clear information hierarchy.

## 12. Project hero

```
Mara Wetland Restoration
Northern Germany · Rhine Catchment · RESTORATION PROJECT
Expected issuance 12,400 units · Available 7,600 units
Expected period 2028 · Deal types Forward, Co-investment
[Express interest]
```

Do not use fake statistics. Use demo data only when explicitly marked as demo data.

## 13. Catchment map

A major visual section. Display project boundary, catchment, nearby relevant geography, satellite/map view.

If the logged-in buyer has registered sites: "Your site is 42 km from this project." Never show another organization's private sites.

Provide "Download GeoJSON". The map should feel analytical rather than decorative.

## 14. Project summary

Concise: what is being restored, why, what environmental outcomes are expected, what is being measured. Simple language. Expandable sections for deeper information.

## 15. Outcomes

Section "Environmental outcomes". Separate WATER, BIODIVERSITY, and other project-specific outcomes.

For each: metric, baseline, expected result, monitoring method, monitoring period, verifier, uncertainty, source, date.

**Do not combine unrelated project metrics into one fake score.**

## 16. Claim rights

Dedicated section "Claim rights". Plain language: who can claim the benefit, what they can claim, what is excluded. Clean table:

| Benefit | Claim holder | Allowed use | Exclusions |

Avoid legal-sounding language unless supplied by the source data.

## 17. Durability

Section "Long-term protection": who controls the land, who maintains it, how long the commitment lasts, what happens after the contract. Simple timeline:

```
2026 Project begins · 2027 Restoration · 2028 Verification · 2033 Contract ends · 2033+ Long-term management
```

Only display dates actually available in the project data.

## 18. Availability

Must be extremely clear. Show availability PER PROJECT and PER PERIOD.

```
2028  Expected 12,400 · Committed 4,800 · Buffer 1,000 · Available 6,600
2029  Expected 10,000 · Committed 2,000 · Buffer   800 · Available 7,200
```

**Never create "Total platform units" if those units come from different projects and cannot be compared. Never add incompatible unit types.**

## 19. Documents

Professional document section. Project Idea Note, Project Design Document, Monitoring Plan, Verification Report.

Display: document name, type, version, date, uploaded by, [View] [Download]. Document-style UI.

## 20. Project partners

Project developer, land owner, verifier, other relevant partners. Organization cards. Do not make this look like social media profiles.

## 21. Reporting evidence pack

Section "Reporting evidence". Downloadable evidence pack including project description, measurable action, timeframe, expected impact, budget where available, verification information, supporting documents.

State clearly: *"This evidence pack describes the information available on the platform. It does not guarantee acceptance by a particular auditor."*

## 22. Investor view

Different experience from normal buyers. Investor-only information visually separated.

FINANCING — funding required (e.g. €1,200,000), revenue streams, financial model [Download], expected unit issuance, project documentation.

Access only for approved investors. Clear badge: "Investor access".

## 23. Express interest

Primary CTA "Express interest". On click:
- not logged in → login/register
- organization not approved → explain vetting process
- approved → create interest event, open private deal room

Confirmation screen "Interest recorded" showing project, organization, date, next step, "Open deal room".

## 24. Deal room

A secure professional workspace. LEFT: deal information, project, participants, deal type, current stage. RIGHT: messages, documents, activity. Header/bottom stage timeline:

```
Interest → LOI → Term Sheet → Signed
```

Do NOT make it look like a chat app. It should feel like a transaction workspace.

## 25. Deal room documents

Draft agreements, term sheets, LOIs, supporting documents, signed agreement, version history. Each: name, version, date, author, status, actions.

## 26. Deal activity

Chronological timeline, e.g. interest expressed → owner responded → draft term sheet uploaded → term sheet agreed → signed agreement uploaded. This timeline is part of the permanent record.

## 27. Buyer dashboard

My projects, my registered sites, my interests, my deals, my documents, organization status, vetting status. Do NOT make it look like a generic analytics dashboard.

## 28. Buyer site registration

Register company sites: name, location, coordinates, organization, optional metadata. Then show distance between their site and the project on project pages. **This information must remain private.**

## 29. Investor dashboard

Projects seeking financing, projects under review, my interests, my deals, financial information available, documents, investment discussions. Keep the interface analytical.

## 30. Admin dashboard

Projects, organizations, users, vetting, deals, documents, transaction records, audit events, system settings.

Admin can: approve organization, reject organization, approve project, review project information, review transaction activity, review disclosure settings, manage platform content.

## 31. Auditor view

READ ONLY. Project information, documents, transaction history, registry references, deal records, identity information where permitted, verification information. No editing.

## 32. Transaction record UI

Public transaction record, e.g.:

```
PROJECT  Mara Wetland Restoration
EVENT    Interest expressed
BUYER    Buyer 014 · Food & Beverage · Germany
DATE     23 September 2026
```

Buyer is pseudonymous by default. If the buyer has chosen disclosure, show the organization name.

## 33. Data sources

Every important number shows source and date:

```
Expected issuance 12,400 units
Source: Project Design Document · Updated: 12 September 2026
```

This is extremely important for trust.

## 34. Responsive design

Desktop primary; must work properly on desktop, tablet, mobile. On mobile prioritise project name, location, key outcomes, availability, Express Interest. Maps remain usable. Tables become horizontally scrollable or responsive.

## 35. Accessibility

Semantic HTML, keyboard navigation, visible focus states, proper contrast, accessible forms, labels, meaningful error messages, screen-reader-friendly structure. Do not rely only on colour to communicate status.

## 36. Microinteractions

Subtle only: button hover, page transitions, map interaction, accordion expansion, document loading, success states.

Avoid excessive motion, animated backgrounds, parallax, decorative animation. Calm and serious.

## 37. Empty states

Thoughtful. "No projects match your current filters." · "You don't have any active deals yet." · "No documents have been uploaded yet." · "Add your company sites to compare their distance to restoration projects."

## 38. Error states

Understandable. Not just "Something went wrong."
Instead: "We couldn't load this project. Please try again." Permission: "You don't have access to this information."

## 39. Loading states

Skeleton loading states. Do not freeze the interface. Maps have loading states. Documents have upload progress.

## 40. Design system

Reusable components: Button, Input, Select, Dropdown, Badge, Status, Card, Table, Metric, Map, Timeline, Document row, Organization card, Project card, Filter, Modal, Drawer, Toast, Tabs, Accordion, Breadcrumb, Pagination, Empty state, Error state, Loading skeleton.

## 41. Component principles

Reusable, accessible, composable, responsive, consistent. Do not create one-off components for every screen. Create a proper design system.

## 42. Frontend architecture

Structure around: public pages, authenticated application, role-based dashboards, project pages, deal rooms, admin, auditor, shared design system, shared data layer, shared authentication state, shared permission system.

## 43. Demo data

Realistic DEMO DATA, e.g. "Mara Wetland Restoration" — clearly marked **DEMO PROJECT**. Do not represent fictional environmental numbers as real.

Create 3–5 demo projects, several organizations, buyers, investors, project owners, auditors, different project statuses, different deal stages, different unit schemes, different project outcomes. Use this data to demonstrate that the platform handles different projects correctly.

## 44. Critical data UX rule

The UI must NEVER imply that different project units are interchangeable.

BAD — "Total available units: 125,000" combining unrelated projects.
GOOD — "Project A: 6,500 available units" / "Project B: 12,000 available units", each with its own unit type and scheme.

## 45. Copywriting style

Clear, direct. Avoid corporate buzzwords.

Avoid: "Unlock the future of nature-positive transformation."
Instead: "Review restoration projects and the evidence behind their expected outcomes."

Language a finance analyst, sustainability manager, investor or project owner can understand. Do not exaggerate. Do not promise environmental results that have not been verified.

## 46. Trust signals

Trust through information: verified, independent verifier, source, date, registry reference, document, version, audit trail. Do not use meaningless trust badges.

## 47. Final UX test

- Can a new buyer understand the project within 10 minutes?
- Can an investor find the financing information?
- Can a project owner understand how to present a project?
- Can a buyer express interest without confusion?
- Can an auditor follow the history of a transaction?
- Can users clearly understand the difference between project, environmental outcome, unit, buyer, investor, co-investor, project owner, verifier?
- Can the UI prevent users from thinking that buying a unit means buying ownership of the land?
- Can the UI prevent users from thinking that the platform itself is the official credit registry?
- Can the UI prevent users from confusing environmental verification with financial investment success?

If not, improve the UX.

## 48. Final design goal

Feel like: *"Bloomberg-style information discipline + modern European institutional design + a project marketplace + a secure transaction workspace."* — but do NOT copy Bloomberg or any specific company's visual identity.

The interface should feel: CALM · TRUSTWORTHY · EVIDENCE-DRIVEN · EUROPEAN · PROFESSIONAL · DATA-ORIENTED · NATURE-AWARE · NOT MARKETING-HEAVY

The user should feel *"I can actually evaluate this project here."* — not *"This is an environmental marketing website."*
