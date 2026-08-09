# Student waiting states

The post-response area is an adaptive slot, not a single generic confirmation screen. Its job is to use the short pause after a student answers without turning participation into extra homework.

## Selection rules

| Interaction | Waiting activity | Practical purpose |
| --- | --- | --- |
| Quiz with class questions | Question Commons | Upvote the question the instructor should discuss next. |
| Quiz without class questions | Private confidence check | Notice whether the answer was a guess or something the student could explain. |
| Poll | Private class prediction | Predict the room result before it appears and compare intuition with the class. |
| Pulse | Calm room-forming view | Avoid asking for more emotional or cognitive work after a check-in. |
| Open response with class questions | Question Commons | Surface the most useful follow-up while the instructor reviews ideas. |
| Open response without class questions | Calm review view | Confirm that the response is saved while the instructor reads the room. |

## Product boundaries

- Waiting activities are optional. Students can look up as soon as their response is sent.
- The submitted answer stays visible and collapsible.
- The phone shows at most two top questions in the waiting view so the classroom cue stays visible without scrolling.
- A saved classroom starts with no canned questions. The instructor can publish a question from the live question rail, and it appears on student phones immediately.
- Upvotes are reversible and connected to the instructor question total.
- Questions are anonymous to classmates, but visible to the instructor.
- Student-submitted questions are not exposed yet. That feature needs an instructor moderation queue, a clear publish action, and abuse controls before it belongs in the live student flow.
- Private predictions and confidence checks do not alter the class answer or appear on the projector.
- Motion is ambient only. Reduced-motion preferences remove the particle animation.

## Next moderation milestone

When student question submission is added, it should follow this path:

1. Student writes a question and sees `Sent to your instructor`.
2. The question enters an instructor-only queue.
3. The instructor can publish, merge, dismiss, or discuss it.
4. Only published questions appear in Question Commons.
5. Published questions can be upvoted once per student account or anonymous session.
