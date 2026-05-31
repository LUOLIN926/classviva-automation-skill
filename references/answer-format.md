# Classviva Answer Format

Use these rules when checking or filling user-confirmed math answers in Classviva.

## Basic Input Rules

- Use ASCII / English input symbols only.
- Valid common symbols: `+ - * / ^ ** ( ) [ ] { } , . ! _ >< U`.
- Avoid full-width symbols such as `＋ – ＊ ／ ＾ （ ）`.
- Use balanced grouping. Classviva may render `[ ]` and `{ }` as parentheses, but the typed answer must still be syntactically valid.
- Type `DNE` when the expected answer is "does not exist".

## Operators

Common precedence from high to low:

| Operator | Meaning |
| --- | --- |
| `_` | Vector or matrix element extraction |
| `!` | Factorial |
| `^`, `**` | Power |
| unary `+`, unary `-` | Sign |
| `/`, `*` | Division and multiplication |
| `.`, `><` | Dot and cross product |
| `U` | Union |
| binary `-`, binary `+` | Subtraction and addition |
| `,` | List separator |

Use parentheses when precedence could be ambiguous.

## Constants

- `e`
- `pi`

## Functions

Prefer explicit parentheses:

- `sqrt()`
- `abs()`
- `ln()`
- `log()`
- `log10()`, `logten()`
- `sin()`, `cos()`, `tan()`
- `sec()`, `csc()`, `cot()`
- `asin()`, `arcsin()`
- `acos()`, `arccos()`
- `atan()`, `arctan()`, `atan2()`
- `sinh()`, `cosh()`, `tanh()`
- `sech()`, `csch()`, `coth()`
- `asinh()`, `arcsinh()`
- `acosh()`, `arccosh()`
- `atanh()`, `arctanh()`
- `norm()`, `unit()`
- `arg()`, `mod()`, `Re()`, `Im()`, `conj()`

Examples:

- Prefer `sin(x)` over `sinx`.
- Prefer `sqrt(x^2+1)` over `sqrt x^2+1`.

## Greek Letters

Type Greek letters by name:

| Symbol | Input | Symbol | Input |
| --- | --- | --- | --- |
| alpha | `alpha` | beta | `beta` |
| gamma | `gamma` | delta | `delta` |
| epsilon | `epsilon` | zeta | `zeta` |
| eta | `eta` | theta | `theta` |
| iota | `iota` | kappa | `kappa` |
| lambda | `lambda` | mu | `mu` |
| nu | `nu` | xi | `xi` |
| omicron | `omicron` | pi | `pi` |
| rho | `rho` | sigma | `sigma` |
| sigmaf | `sigmaf` | tau | `tau` |
| upsilon | `upsilon` | phi | `phi` |
| chi | `chi` | psi | `psi` |
| omega | `omega` | thetasym | `thetasym` |
| upsih | `upsih` | piv | `piv` |

## Filling Checklist

- Confirm the answer came from the user or is being used only for learning/checking.
- Convert LaTeX-only notation into Classviva's plain input syntax before filling.
- Re-run `window.ClassvivaExtractor.verify()` after filling.
- Do not submit from this skill.
