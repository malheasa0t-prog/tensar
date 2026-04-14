import test from "node:test";
import assert from "node:assert/strict";
import { SOCIAL_CHANNELS } from "./contactChannels/defaults.js";
import { getContactMethods } from "./contactChannels.js";
import {
  getSocialBrandIcon,
  isSocialBrandIcon,
} from "./socialBrandIcons.js";

test("getSocialBrandIcon should expose SVG data for supported social brands", () => {
  const supportedIcons = [
    "whatsapp",
    "telegram",
    "tiktok",
    "x",
    "snapchat",
    "facebook",
    "instagram",
    "youtube",
  ];

  supportedIcons.forEach((name) => {
    const icon = getSocialBrandIcon(name);

    assert.ok(icon);
    assert.equal(icon.viewBox, "0 0 24 24");
    assert.match(icon.path, /\S+/);
  });
});

test("isSocialBrandIcon should reject invalid or unknown icon names", () => {
  assert.equal(isSocialBrandIcon(""), false);
  assert.equal(isSocialBrandIcon("unknown"), false);
  assert.equal(isSocialBrandIcon(null), false);
});

test("SOCIAL_CHANNELS should point supported networks at their brand icons", () => {
  const supportedChannelKeys = [
    "whatsapp",
    "instagram",
    "tiktok",
    "x",
    "snapchat",
    "facebook",
    "youtube",
    "telegram",
  ];

  supportedChannelKeys.forEach((key) => {
    const channel = SOCIAL_CHANNELS.find((item) => item.key === key);

    assert.ok(channel);
    assert.equal(channel.icon, key);
  });
});

test("getContactMethods should use the WhatsApp brand icon for direct chat", () => {
  const methods = getContactMethods({
    company: {
      phone: "+962790000000",
    },
  });

  const whatsappMethod = methods.find((item) => item.key === "whatsapp");

  assert.ok(whatsappMethod);
  assert.equal(whatsappMethod.icon, "whatsapp");
});
