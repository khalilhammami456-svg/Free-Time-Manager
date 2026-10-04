#!/bin/sh
# Re-installs the curated design skills into <target>/.claude/skills (default: current dir).
# Every source is pinned to the commit SHA that was security-reviewed (see skills/INSTALLED.md).
# Pure file copy: nothing here executes third-party code or downloads binaries.
set -eu
TARGET="${1:-.}/.claude/skills"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$TARGET"

fetch() { # name repo sha
  git clone -q --filter=blob:none --no-checkout "https://github.com/$2" "$WORK/$1"
  git -C "$WORK/$1" checkout -q "$3"
}

fetch impeccable pbakaus/impeccable 6e802bd0ed99f53180e2359fddab6da8d97970d9
cp -R "$WORK/impeccable/plugin/skills/impeccable" "$TARGET/impeccable"
rm -rf "$TARGET/impeccable/scripts"   # DELIBERATE: no binary launcher, no hooks. See INSTALLED.md.
cp "$WORK/impeccable/LICENSE" "$TARGET/impeccable/LICENSE"
# Inject the local note (not upstream) right after the "## Setup" heading so future sessions skip the launcher.
NOTE="$(dirname "$0")/../skills/impeccable-local-note.md"
awk -v note="$(cat "$NOTE")" '{print} /^## Setup$/ && !d {print ""; print note; d=1}' \
  "$TARGET/impeccable/SKILL.md" > "$TARGET/impeccable/SKILL.md.new" && mv "$TARGET/impeccable/SKILL.md.new" "$TARGET/impeccable/SKILL.md"

fetch lottie lottiefiles/motion-design-skill f9a8a041b85185ee4881b3471d3415e939aac772
cp -R "$WORK/lottie/skills/motion-design" "$TARGET/motion-design"

fetch emil emilkowalski/skills e8a175de22ae1e49370fc144c1f3bb9aeedf988d
for s in emil-design-eng animate review-animations find-animation-opportunities; do
  cp -R "$WORK/emil/skills/$s" "$TARGET/$s"
done
cp "$WORK/emil/LICENSE" "$TARGET/emil-design-eng/LICENSE"

fetch gsap greensock/gsap-skills aed9cfd3277740755f6bfc1155c7aa645403b760
for s in gsap-core gsap-timeline gsap-scrolltrigger gsap-plugins gsap-react gsap-performance; do
  cp -R "$WORK/gsap/skills/$s" "$TARGET/$s"
done
cp "$WORK/gsap/LICENSE" "$TARGET/gsap-core/LICENSE"
fetch fd anthropics/skills 8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4
cp -R "$WORK/fd/skills/frontend-design" "$TARGET/frontend-design"   # named by the notebook spec (Ch.B step 2)

fetch hx hueyexe/frontend-agent-skills 2841c079dd8a9c634882227194dc42e25227710d
for s in accessibility-inclusive-design ux-writing-content-design interaction-patterns-components; do
  cp -R "$WORK/hx/$s" "$TARGET/$s"
done
cp "$WORK/hx/LICENSE" "$TARGET/accessibility-inclusive-design/LICENSE"
echo "Installed into $TARGET"
