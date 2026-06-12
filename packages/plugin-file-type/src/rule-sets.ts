import { prepareMappings } from "./classifier.js";
import type { MappingDefinition, PreparedMappings, RuleSetName } from "./classifier.js";

export interface PreparedRuleSet {
  readonly name: RuleSetName;
  readonly mappings: PreparedMappings;
}

const COMMON_MAPPING_ENTRIES = [
  // Programming languages and source-like formats.
  ["*.ts", "TypeScript"],
  ["*.tsx", "TSX"],
  ["*.d.ts", "TypeScript"],
  ["*.js", "JavaScript"],
  ["*.jsx", "JSX"],
  ["*.mjs", "JavaScript"],
  ["*.cjs", "JavaScript"],
  ["*.java", "Java"],
  ["*.kt", "Kotlin"],
  ["*.kts", "Kotlin Script"],
  ["*.go", "Go"],
  ["*.rs", "Rust"],
  ["*.py", "Python"],
  ["*.rb", "Ruby"],
  ["*.php", "PHP"],
  ["*.cs", "C#"],
  ["*.c", "C"],
  ["*.cpp", "C++"],
  ["*.cxx", "C++"],
  ["*.cc", "C++"],
  ["*.hpp", "C++ header"],
  ["*.hh", "C++ header"],
  ["*.swift", "Swift"],
  ["*.scala", "Scala"],
  ["*.dart", "Dart"],
  ["*.lua", "Lua"],
  ["*.r", "R"],
  ["*.sql", "SQL"],
  ["*.sh", "Shell"],
  ["*.bash", "Bash"],
  ["*.zsh", "Zsh"],
  ["*.fish", "Fish"],
  ["*.ps1", "PowerShell"],

  // Web, UI, and component formats.
  ["*.html", "HTML"],
  ["*.htm", "HTML"],
  ["*.css", "CSS"],
  ["*.scss", "SCSS"],
  ["*.sass", "Sass"],
  ["*.less", "Less"],
  ["*.vue", "Vue"],
  ["*.svelte", "Svelte"],
  ["*.astro", "Astro"],

  // Data, config, markup, and documentation formats.
  ["*.json", "JSON"],
  ["*.jsonc", "JSONC"],
  ["*.yaml", "YAML"],
  ["*.yml", "YAML"],
  ["*.toml", "TOML"],
  ["*.xml", "XML"],
  ["*.ini", "INI"],
  ["*.env", "dotenv"],
  ["*.csv", "CSV"],
  ["*.tsv", "TSV"],
  ["*.md", "Markdown"],
  ["*.mdx", "MDX"],
  ["*.rst", "reStructuredText"],
  ["*.adoc", "AsciiDoc"],
  ["*.graphql", "GraphQL"],
  ["*.gql", "GraphQL"],
  ["*.proto", "Protocol Buffers"],
  ["*.ipynb", "Jupyter Notebook"],

  // Common assets and generated/document artifacts.
  ["*.svg", "SVG"],
  ["*.png", "PNG"],
  ["*.jpg", "JPEG"],
  ["*.jpeg", "JPEG"],
  ["*.gif", "GIF"],
  ["*.webp", "WebP"],
  ["*.avif", "AVIF"],
  ["*.ico", "ICO"],
  ["*.pdf", "PDF"],
  ["*.lock", "lockfile"],

  // Archives and compressed files.
  ["*.zip", "ZIP archive"],
  ["*.tar", "tar archive"],
  ["*.gz", "gzip compressed file"],
  ["*.tgz", "gzip tarball"],
  ["*.bz2", "bzip2 compressed file"],
  ["*.xz", "XZ compressed file"],

  // Common exact basename mappings.
  ["Dockerfile", "Dockerfile"],
  ["Containerfile", "Containerfile"],
  ["Makefile", "Makefile"],
  ["CMakeLists.txt", "CMake project file"],
  ["package.json", "npm package manifest"],
  ["package-lock.json", "npm package lockfile"],
  ["pnpm-lock.yaml", "pnpm lockfile"],
  ["yarn.lock", "Yarn lockfile"],
  ["tsconfig.json", "TypeScript config"],
  ["jsconfig.json", "JavaScript config"],
  ["Cargo.toml", "Cargo manifest"],
  ["Cargo.lock", "Cargo lockfile"],
  ["go.mod", "Go module file"],
  ["go.sum", "Go checksum file"],
  ["pyproject.toml", "Python project file"],
  ["requirements.txt", "Python requirements file"],
  ["Pipfile", "Pipenv manifest"],
  ["Pipfile.lock", "Pipenv lockfile"],
  ["Gemfile", "Ruby Gemfile"],
  ["Gemfile.lock", "Ruby Gemfile lockfile"],
  ["composer.json", "Composer manifest"],
  ["composer.lock", "Composer lockfile"],
  [".gitignore", "Git ignore file"],
  [".gitattributes", "Git attributes file"],
  [".gitmodules", "Git submodules file"],
  [".editorconfig", "EditorConfig"],
  [".npmrc", "npm config"],
] as const satisfies readonly (readonly [string, string])[];

export const BUILT_IN_RULE_SETS: ReadonlyMap<RuleSetName, PreparedRuleSet> = new Map([
  [
    "common",
    { name: "common", mappings: prepareBuiltInMappings("common", COMMON_MAPPING_ENTRIES) },
  ],
]);

function prepareBuiltInMappings(
  source: RuleSetName,
  entries: readonly (readonly [string, string])[],
): PreparedMappings {
  const definitions: MappingDefinition[] = entries.map(([signature, name]) => ({
    signature,
    name,
    source,
  }));
  const prepared = prepareMappings(definitions);
  if (!prepared.ok) {
    throw new Error(`Invalid built-in rule set "${source}": ${prepared.message}`);
  }

  return prepared.value;
}
