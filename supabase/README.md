# Supabase Migrations Workflow

Ei folder-e apnar database schema-er shob migrations timestamped file akare thake.
Lovable agent notun table ba schema change korle ekhane notun migration file toiri kore. Apni shudhu `supabase db push` cholaben.

---

## One-Time Setup (ekbar korte hobe)

### 1. Supabase CLI install korun

```bash
# macOS
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux / npm (any OS)
npm install -g supabase
```

Verify:
```bash
supabase --version
```

### 2. Supabase account-e login korun

```bash
supabase login
```
Browser khulbe — apnar Supabase account diye authorize korun.

### 3. Ei project-er sathe link korun

Project root theke:
```bash
supabase link --project-ref qdveirhlzuzrxaqjevxr
```
Database password chaibe — apnar Supabase Dashboard → Project Settings → Database theke pabben. (Login password NOY, DB password.)

---

## Daily Workflow

Jokhon-i Lovable agent (ba apni) notun migration file `supabase/migrations/` folder-e add korbe:

```bash
supabase db push
```

Eta shob **new** (jegulo age push kora hoy nai) migration Supabase-e apply korbe. Already-applied migration skip korbe.

---

## Useful Commands

| Command | Ki kore |
|---------|---------|
| `supabase db push` | Local migrations remote DB-te apply kore |
| `supabase db pull` | Remote schema pull kore notun migration file banai (jodi apni Dashboard theke direct change koren) |
| `supabase migration list` | Applied vs pending migration dekhay |
| `supabase migration new <name>` | Manually notun empty migration file toiri kore |
| `supabase db reset --linked` | ⚠️ Remote DB reset kore (DANGEROUS — production-e chalaben na) |
| `supabase gen types typescript --linked > src/integrations/supabase/types.ts` | TypeScript types generate kore |

---

## Migration File Naming

Format: `YYYYMMDDHHMMSS_description.sql`

Example:
- `20260718000000_initial_schema.sql`
- `20260719120000_add_applications_table.sql`
- `20260720093000_add_documents_bucket.sql`

Supabase CLI ei timestamp order onujayi migration cholay. **File name kokhono change korben na** applied hoye jawar por — otherwise CLI confusion-e porbe.

---

## Rules

1. ❌ Applied migration file **edit korben na**. Change dorkar hole notun migration banan.
2. ❌ Manually Dashboard theke schema change korle `supabase db pull` cholan schema sync rakhte.
3. ✅ Migration file always git-e commit korun.
4. ✅ Production-e push korar age local ba staging-e test korun.

---

## Troubleshooting

**"failed to connect to postgres"**
Password wrong. `supabase link` abar cholan sthik password diye.

**"migration already exists"**
Ei migration age applied hoyeche. `supabase migration list` diye check korun.

**"permission denied"**
Apnar DB password reset korun Dashboard theke, tarpor `supabase link` abar cholan.
