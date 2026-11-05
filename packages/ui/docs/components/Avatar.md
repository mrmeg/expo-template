---
components: [Avatar, AvatarGroup]
also: [AvatarGroup]
use-for: "Profile images with initials/icon fallback"
instead-of: "Circles with a nested `Image` plus initials `Text`"
---

# Avatar

- `Avatar` with both `source` and `name` whenever both exist: `name` supplies the initials shown when the image is absent, still loading, or failed, plus the default accessibility label. Inside `AvatarGroup`, set `size`/`shape` on the group — children inherit them and gain the ring; the group's count is a hidden summary node, so each member stays individually announceable and the group needs no `accessible` wrapper.
