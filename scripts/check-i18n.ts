/**
 * The i18n linter.
 *
 * Five pages once shipped rendering raw translation keys - "ownerProjectForm.field.nameEn"
 * in place of a label - because the components were written and the messages were not.
 * Nothing failed: `tsc` is happy, the tests were happy, and next-intl renders a missing
 * key as the key itself. This script exists so that class of bug fails the build instead
 * of reaching a reader.
 *
 * It checks four things:
 *
 *   1. PARITY. en.json and de.json hold exactly the same keys, and a key that is an
 *      object in one is an object in the other. A key present in one language only is
 *      how a German page silently starts serving English.
 *
 *   2. RESOLUTION. Every `t('literal')` in src/ resolves to a key that exists, under the
 *      namespace the file's translator was created with. This is the check that would
 *      have caught the five pages.
 *
 *   3. ICU. Every message parses as ICU MessageFormat. A stray brace renders as an
 *      error at request time, not at build time.
 *
 *   4. ARGUMENTS. A message takes the same named arguments in both languages. A German
 *      message that forgot {count} prints a sentence with a hole in it.
 *
 * What it deliberately does NOT do. A key built at runtime - t(`owner.gate.item.${code}.label`)
 * or a key held as a string in a demo-data file - cannot be resolved statically without
 * evaluating the module, so the script counts those calls and prints the count rather
 * than guessing. Verifying them is what rendering the page does; see the README.
 *
 * Exit code 1 fails the build.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const MESSAGES = join(SRC, 'messages');
const LOCALES = ['en', 'de'] as const;
type Locale = (typeof LOCALES)[number];

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

type Tree = { [key: string]: string | Tree };

function load(locale: Locale): Tree {
  return JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), 'utf8')) as Tree;
}

/** Every leaf key, dotted, with its value. Objects are recorded too, marked. */
function flatten(tree: Tree, prefix = '', out = new Map<string, string | null>()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix + key;
    if (value !== null && typeof value === 'object') {
      out.set(path, null); // an object node, not a message
      flatten(value, path + '.', out);
    } else {
      out.set(path, String(value));
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* A very small ICU MessageFormat reader                                       */
/* -------------------------------------------------------------------------- */

const SUB_TYPES = new Set(['plural', 'select', 'selectordinal']);

/**
 * The named arguments a message takes.
 *
 * Written by hand rather than pulled from a parser package because the only thing
 * needed here is the argument names, and a dependency that exists to produce them
 * would be a dependency the build did not have before.
 *
 * Throws on a message that is not well formed, which is the third check.
 */
function icuArguments(message: string, where: string): Set<string> {
  const args = new Set<string>();

  const readBraced = (s: string, open: number): number => {
    // Returns the index of the matching '}', or -1.
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === "'" ) {
        // An ICU quote escapes the next brace run: '{' or a quoted section.
        const next = s.indexOf("'", i + 1);
        if (next !== -1 && /[{}#]/.test(s.slice(i + 1, next))) {
          i = next;
          continue;
        }
      }
      if (s[i] === '{') depth++;
      else if (s[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  const walk = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "'") {
        const next = s.indexOf("'", i + 1);
        if (next !== -1 && /[{}#]/.test(s.slice(i + 1, next))) {
          i = next;
          continue;
        }
      }
      if (s[i] === '}') {
        throw new Error(`unbalanced "}" in ${where}`);
      }
      if (s[i] !== '{') continue;

      const close = readBraced(s, i);
      if (close === -1) throw new Error(`unclosed "{" in ${where}`);
      const inner = s.slice(i + 1, close);
      i = close;

      const simple = /^\s*([A-Za-z0-9_]+)\s*$/.exec(inner);
      if (simple?.[1]) {
        args.add(simple[1]);
        continue;
      }

      const typed = /^\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z]+)\s*(?:,([\s\S]*))?$/.exec(inner);
      if (!typed?.[1] || !typed[2]) {
        throw new Error(`cannot read the argument "{${inner}}" in ${where}`);
      }

      const name = typed[1];
      const type = typed[2];
      const rest = typed[3] ?? '';
      args.add(name);
      if (!SUB_TYPES.has(type)) continue; // number / date / time: a style, not messages

      // plural and select hold option bodies, and each body is a message of its own.
      let j = 0;
      while (j < rest.length) {
        if (rest[j] !== '{') {
          j++;
          continue;
        }
        const end = readBraced(rest, j);
        if (end === -1) throw new Error(`unclosed option body in ${where}`);
        walk(rest.slice(j + 1, end));
        j = end + 1;
      }
    }
  };

  walk(message);
  return args;
}

/* -------------------------------------------------------------------------- */
/* Reading the source                                                          */
/* -------------------------------------------------------------------------- */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'messages') continue;
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * The translator variables a file declares, and the namespaces each was created with.
 *
 * `const t = useTranslations('owner')`        -> t     is scoped to owner.*
 * `const t = await getTranslations()`         -> t     is scoped to the root
 * `getTranslations({ locale, namespace: 'x'})`-> that  is scoped to x.*
 *
 * A name can carry more than one namespace in one file, because `generateMetadata`
 * routinely declares its own `t` scoped to the page's namespace while the component
 * below it declares a `t` at the root. Rather than model the scopes, a key is accepted
 * if it resolves under any namespace that name was bound to in the file: a key that
 * exists nowhere still fails, which is what this check is for.
 */
function translators(source: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const pattern =
    /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\s*\(([^)]*)\)/g;

  for (const m of source.matchAll(pattern)) {
    const name = m[1];
    const rawArgs = m[2] ?? '';
    if (!name) continue;
    const object = /namespace\s*:\s*['"]([^'"]+)['"]/.exec(rawArgs);
    const positional = /^\s*['"]([^'"]+)['"]\s*$/.exec(rawArgs);
    const namespace = object?.[1] ?? positional?.[1] ?? '';
    const set = found.get(name) ?? new Set<string>();
    set.add(namespace);
    found.set(name, set);
  }
  return found;
}

interface Problem {
  file: string;
  line: number;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* The checks                                                                  */
/* -------------------------------------------------------------------------- */

function main(): number {
  const problems: Problem[] = [];
  const note = (file: string, line: number, message: string) =>
    problems.push({ file, line, message });

  const flat = new Map<Locale, Map<string, string | null>>();
  for (const locale of LOCALES) flat.set(locale, flatten(load(locale)));

  const en = flat.get('en')!;
  const de = flat.get('de')!;

  /* 1. Parity ------------------------------------------------------------- */

  for (const key of en.keys()) {
    if (!de.has(key)) note('src/messages/de.json', 0, `missing key: ${key}`);
  }
  for (const key of de.keys()) {
    if (!en.has(key)) note('src/messages/en.json', 0, `missing key: ${key}`);
  }
  for (const [key, value] of en) {
    if (!de.has(key)) continue;
    const other = de.get(key)!;
    if ((value === null) !== (other === null)) {
      note(
        'src/messages/de.json',
        0,
        `${key} is ${value === null ? 'a group in en and a message in de' : 'a message in en and a group in de'}`,
      );
    }
  }

  /* 3 and 4. ICU, and the same arguments in both languages ----------------- */

  for (const [key, value] of en) {
    if (value === null) continue;
    let enArgs: Set<string>;
    try {
      enArgs = icuArguments(value, key);
    } catch (error) {
      note('src/messages/en.json', 0, `${(error as Error).message}`);
      continue;
    }
    const other = de.get(key);
    if (other == null) continue;
    let deArgs: Set<string>;
    try {
      deArgs = icuArguments(other, key);
    } catch (error) {
      note('src/messages/de.json', 0, `${(error as Error).message}`);
      continue;
    }
    const onlyEn = [...enArgs].filter((a) => !deArgs.has(a));
    const onlyDe = [...deArgs].filter((a) => !enArgs.has(a));
    if (onlyEn.length > 0 || onlyDe.length > 0) {
      note(
        'src/messages/de.json',
        0,
        `${key} takes different arguments in each language` +
          (onlyEn.length > 0 ? ` - only in en: ${onlyEn.join(', ')}` : '') +
          (onlyDe.length > 0 ? ` - only in de: ${onlyDe.join(', ')}` : ''),
      );
    }
  }

  /* 2. Every literal t('…') resolves -------------------------------------- */

  let dynamic = 0;
  let literal = 0;

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    const scopes = translators(source);
    if (scopes.size === 0) continue;

    const names = [...scopes.keys()].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const call = new RegExp(`\\b(${names.join('|')})(?:\\.(rich|raw|markup|has))?\\s*\\(`, 'g');

    for (const m of source.matchAll(call)) {
      // t.has('…') asks whether a key exists. A key it does not find is the answer,
      // not a fault, so a probe is never a missing message.
      if (m[2] === 'has') continue;

      const after = source.slice(m.index! + m[0].length);
      const line = source.slice(0, m.index!).split('\n').length;

      if (/^\s*[`]/.test(after)) {
        dynamic++;
        continue;
      }
      const arg = /^\s*(['"])([^'"\n]*)\1/.exec(after);
      if (!arg) {
        dynamic++; // a variable, a member expression, or a call - not resolvable here
        continue;
      }

      literal++;
      const asked = arg[2] ?? '';
      const bound = scopes.get(m[1] ?? '') ?? new Set<string>();
      const candidates = [...bound].map((ns) => (ns ? `${ns}.${asked}` : asked));
      const resolved = candidates.filter((key) => en.get(key) !== undefined);

      if (resolved.length === 0) {
        note(rel, line, `no message for ${candidates.join(' or ')}`);
      } else if (resolved.every((key) => en.get(key) === null)) {
        note(rel, line, `${resolved.join(' / ')} is a group of messages, not a message`);
      }
    }
  }

  /* Report ----------------------------------------------------------------- */

  // en holds group nodes as well as messages; a "key" is a message a page can render.
  const total = [...en.values()].filter((v) => v !== null).length;
  if (problems.length === 0) {
    console.log(
      `i18n ok - ${total} messages in parity across ${LOCALES.join(' and ')}, ` +
        `${literal} literal t() calls resolved, ${dynamic} built at runtime (verified by rendering).`,
    );
    return 0;
  }

  console.error(`i18n: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n`);
  for (const p of problems) {
    console.error(`  ${p.file}${p.line > 0 ? `:${p.line}` : ''}  ${p.message}`);
  }
  console.error(
    '\nAdd the missing keys to BOTH src/messages/en.json and src/messages/de.json, with real German.',
  );
  return 1;
}

process.exit(main());
