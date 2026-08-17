# Scheduled Codex task contract

Use this prompt as the basis for the scheduled Classfully content task.

## Objective

Create or improve one high-value Classfully Field Notes article using current Search Console evidence, the existing content library, current product behavior, and credible external sources.

## Required workflow

1. Read `docs/content-engine/README.md` and `docs/content-engine/ARTICLE_STANDARD.md` completely.
2. Inspect every post registered in `src/content/blog/index.ts` and every entry in `src/content/blog/content-calendar.ts` to avoid overlap and conflicting claims.
3. Inspect current product code before describing a Classfully capability. Do not rely on an older article as proof that a feature still works.
4. Read the latest approved Search Console snapshot in `output/content-engine/gsc/`.
5. Score opportunities using:
   - relevance to a university instructor
   - evidence of demand or emerging impressions
   - current ranking position and CTR
   - product fit
   - ability to offer original value
   - proximity to class creation or activation
6. Choose one action:
   - create a new article
   - improve an existing article
   - recommend no article because the available opportunities are weak
7. Research the topic. Prefer official sources and original research. Attach a source to any factual or comparative claim that could change.
8. Write in the typed structure defined by `src/content/blog/types.ts`.
9. Generate one cover image with the built-in image generation tool. Use the reference visual to extract written art-direction traits only, such as palette, tactile depth, adult university context, and the shared-signal motif. Do not attach the reference visual to the generation call. Create a new classroom moment with a clearly different camera angle, spatial layout, focal action, and signal behavior. Do not place text in the image.
10. Save the final image as WebP under `public/images/blog/`, ideally below 250 KB while keeping enough detail for a 1536 by 1024 display.
11. Compare the generated cover with every existing Field Notes cover before accepting it. Reject it when the room geometry, camera position, subject placement, or response path reads as a variation of an existing image.
12. Register the post in `src/content/blog/index.ts` with `status: 'draft'` and update its content calendar entry.
13. Run typecheck, lint, build, and focused visual checks at mobile and desktop widths.
14. Create a draft branch or pull request with:
    - target query
    - why the topic was selected
    - Search Console evidence
    - what original value was added
    - claims that need human review
    - intended CTA and conversion stage

## Hard boundaries

- Never publish or deploy without explicit approval.
- Never invent Classfully features, customers, results, testimonials, or usage data.
- Never expose student data, student IDs, raw responses, or instructor records.
- Never generate a competitor comparison without checking the competitor's current official product information.
- Never create backlinks through an automated exchange.
- Never use an em dash.
- Never pad an article to reach a word count.
- Never use generic stock phrases such as "in today's fast-paced world," "game-changer," "unlock the power," or "revolutionize."
- Never use a generic conclusion. End with a specific action the instructor can take.

## Scheduling rhythm

Run opportunity analysis weekly. A weekly run does not require a weekly publication. Quality and product relevance decide whether a draft is created.

Once per month, use the same process to review published articles for:

- high impressions with low CTR
- positions 5 to 20 that may benefit from deeper coverage or internal links
- traffic that is not creating instructor accounts
- outdated product or competitor claims
- competing articles targeting the same intent
