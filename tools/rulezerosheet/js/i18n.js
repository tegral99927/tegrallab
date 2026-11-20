/**
 * i18n.js - 国際化ヘルパー
 */

import ja from "../lang/ja.js";
import en from "../lang/en.js";

const dictionaries = { ja, en };

export class I18nManager {
  constructor(defaultLang = "ja") {
    this.lang = defaultLang;
  }

  setLang(lang) {
    if (dictionaries[lang]) {
      this.lang = lang;
    }
  }

  getLang() {
    return this.lang;
  }

  t(key, params = {}) {
    const dict = dictionaries[this.lang] || dictionaries.ja;
    let text = dict[key] || dictionaries.ja[key] || key;

    // パラメータ置換 ({count}, {limit} など)
    Object.keys(params).forEach(k => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
    });

    return text;
  }

  applyToDOM(root = document) {
    // data-i18n="key" を持つ要素を更新
    root.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const translated = this.t(key);
      if (translated) {
        el.textContent = translated;
      }
    });

    // data-i18n-placeholder="key" を持つ要素を更新
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      const translated = this.t(key);
      if (translated) {
        el.setAttribute("placeholder", translated);
      }
    });

    // data-i18n-title="key" を持つ要素を更新
    root.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      const translated = this.t(key);
      if (translated) {
        el.setAttribute("title", translated);
      }
    });
  }
}

export const i18n = new I18nManager("ja");
