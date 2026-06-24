import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export default async function GuidePage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guide"
        description="How to use Zillow Finder to find profitable short-term rental opportunities."
      />

      {/* Quick overview */}
      <Card>
        <CardHeader>
          <CardTitle>What This Tool Does</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <p>
            Zillow Finder searches for rental properties across US states, identifies the owner
            or management company, and estimates what each property could earn as a short-term
            rental (Airbnb). It then tells you which deals are profitable.
          </p>
          <p className="font-medium">The flow:</p>
          <ol>
            <li>Add your API credentials (required before anything else)</li>
            <li>Select states → scrape Zillow for rental listings</li>
            <li>System classifies each listing as owner-posted or management company</li>
            <li>Enrich results with STR revenue data (AirDNA)</li>
            <li>See which properties have the best spread (STR revenue − monthly rent)</li>
          </ol>
        </CardContent>
      </Card>

      {/* Credentials - FIRST STEP */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Adding Credentials</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <p>
            Before you can run any search, you need to add at least one API credential.
            The system uses these to talk to external services (Zillow scraping, STR revenue data).
          </p>

          <h4>Required: Apify API Token</h4>
          <p>This is needed for all Zillow searches. Without it, nothing works.</p>
          <ol>
            <li>Go to <a href="https://apify.com" target="_blank" rel="noopener noreferrer">apify.com</a> and create an account.</li>
            <li>Go to Settings → Integrations → API token. Copy your token.</li>
            <li>In this app, go to <strong>Credentials</strong> page (admin only).</li>
            <li>Click <strong>Add Credential</strong>.</li>
            <li>Fill in:
              <ul>
                <li><strong>Provider:</strong> <code>apify</code></li>
                <li><strong>Label:</strong> anything you want (e.g. "My Apify key")</li>
                <li><strong>Token:</strong> paste your Apify API token</li>
                <li><strong>Monthly result limit:</strong> optional cap (e.g. 10000)</li>
              </ul>
            </li>
            <li>Save. The token is encrypted and stored securely — it's never shown again.</li>
          </ol>

          <h4>Optional: AirDNA API Token</h4>
          <p>This gives you better STR revenue estimates. Without it, the system falls back to Airbnb scraping (less accurate, uses your Apify credits).</p>
          <ol>
            <li>Sign up at <a href="https://www.airdna.co" target="_blank" rel="noopener noreferrer">airdna.co</a> and get API access.</li>
            <li>Copy your API key.</li>
            <li>In this app, go to <strong>Credentials</strong> → <strong>Add Credential</strong>.</li>
            <li>Fill in:
              <ul>
                <li><strong>Provider:</strong> <code>airdna</code></li>
                <li><strong>Label:</strong> e.g. "AirDNA key"</li>
                <li><strong>Token:</strong> paste your AirDNA API key</li>
              </ul>
            </li>
            <li>Save.</li>
          </ol>

          <h4>Budget Limits</h4>
          <p>
            Each credential can have a <strong>monthly result limit</strong>. Once you hit it,
            the system stops using that credential until next month. This prevents unexpected costs.
            You can also set a global budget in <strong>Settings</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Running a search */}
      <Card>
        <CardHeader>
          <CardTitle>Running a Search</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <ol>
            <li>
              Go to the <strong>Searches</strong> page.
            </li>
            <li>
              You'll see a <strong>state selector</strong> with all 50 US states checked.
              Untick any states you don't want to search.
            </li>
            <li>
              Set your options:
              <ul>
                <li><strong>Max results per state</strong> — limits how many listings to fetch per state (default: 200).</li>
                <li><strong>Min bedrooms</strong> — only find properties with this many bedrooms or more.</li>
                <li><strong>Max monthly rent</strong> — price ceiling.</li>
                <li><strong>Owner-listed only</strong> — excludes properties listed by management companies.</li>
                <li><strong>Skip states searched recently</strong> — avoids re-searching states done in the last 7 days. The system always prioritizes states that haven't been searched before.</li>
              </ul>
            </li>
            <li>
              Click <strong>"Search X States"</strong> and confirm the cost estimate.
            </li>
            <li>
              The search runs in the background. States are processed one at a time.
              You'll see the status update automatically.
            </li>
          </ol>

          <h4>Advanced Search (URL mode)</h4>
          <p>
            Click <strong>"Advanced (URL)"</strong> to switch to manual mode. Go to
            zillow.com, apply any filters you want, copy the URL, and paste it in.
            This is useful for targeting specific cities or neighborhoods.
          </p>
        </CardContent>
      </Card>

      {/* Understanding results */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding Results</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <p>Each result card shows:</p>
          <table>
            <thead>
              <tr><th>Field</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Rent</strong></td><td>Monthly rental price from Zillow</td></tr>
              <tr><td><strong>Owner badge</strong></td><td>Green "Owner" = individual owner. Amber "Mgmt" = management company</td></tr>
              <tr><td><strong>Contact info</strong></td><td>Phone/email if available. Otherwise click the listing link to find it manually.</td></tr>
              <tr><td><strong>STR rev</strong></td><td>Estimated monthly revenue if listed on Airbnb (from AirDNA)</td></tr>
              <tr><td><strong>Spread</strong></td><td>STR revenue − rent. Green = profitable. Red = losing money.</td></tr>
              <tr><td><strong>Deal verdict</strong></td><td>Good = both spread and ratio thresholds met. Marginal = one met. Poor = neither.</td></tr>
              <tr><td><strong>ADR / Occupancy</strong></td><td>Average daily rate and expected occupancy % for similar properties in that area</td></tr>
            </tbody>
          </table>

          <h4>Filters</h4>
          <p>Use the filter bar at the top of the Results page to narrow by:</p>
          <ul>
            <li>State, City</li>
            <li>Min/Max rent</li>
            <li>Min beds, Min baths</li>
            <li>Owner type (Owner / Management)</li>
            <li>Deal verdict (Good / Marginal / Poor)</li>
          </ul>

          <h4>Sorting</h4>
          <ul>
            <li><strong>Spread</strong> (default) — highest profit potential first</li>
            <li><strong>STR revenue</strong> — highest earning potential first</li>
            <li><strong>Rent</strong> — cheapest first</li>
            <li><strong>Days on market</strong> — newest listings first</li>
          </ul>
        </CardContent>
      </Card>

      {/* Enriching with STR data */}
      <Card>
        <CardHeader>
          <CardTitle>Enriching with STR Revenue Data</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <p>
            After a search finishes, you can enrich results with short-term rental
            revenue estimates:
          </p>
          <ol>
            <li>On the <strong>Searches</strong> page, find your completed search.</li>
            <li>Click <strong>"Enrich"</strong> next to it.</li>
            <li>The system calls AirDNA (or Airbnb via Apify as a fallback) to get revenue data for each city/state/bedroom combination.</li>
            <li>Results are cached — the same market is only paid for once regardless of how many properties are in that area.</li>
            <li>Once done, go to <strong>Results</strong> to see the STR revenue, spread, and deal verdicts.</li>
          </ol>
          <p className="text-muted-foreground">
            Note: You need an AirDNA credential added under Credentials for best results.
            Without it, the system uses Airbnb scraping via Apify as a fallback.
          </p>
        </CardContent>
      </Card>

      {/* How deduplication works */}
      <Card>
        <CardHeader>
          <CardTitle>Deduplication & Smart Prioritization</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <ul>
            <li>
              <strong>No duplicate listings</strong> — if the same property appears in multiple searches,
              it's stored once and updated (not duplicated).
            </li>
            <li>
              <strong>States you haven't searched are done first</strong> — the system always
              prioritizes new areas over re-running areas you've already covered.
            </li>
            <li>
              <strong>Skip recently searched</strong> — with this option on, states searched
              in the last 7 days are skipped automatically. You'll see "today" or "Xd ago"
              labels on states in the selector.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Owner vs Management */}
      <Card>
        <CardHeader>
          <CardTitle>Owner vs. Management Company</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <p>
            Each listing is automatically classified based on the broker/agent name from Zillow:
          </p>
          <ul>
            <li><strong>Owner</strong> (green badge) — individual person's name, likely the property owner</li>
            <li><strong>Mgmt</strong> (amber badge) — contains keywords like LLC, Inc, Realty, Properties, Management, etc.</li>
          </ul>
          <p>
            Use the <strong>"Owner-listed only"</strong> checkbox during search to exclude management companies,
            or filter them out on the Results page.
          </p>
        </CardContent>
      </Card>

      {/* Admin-only section */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Admin: Setup & Configuration</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none">
            <h4>Initial Setup</h4>
            <ol>
              <li>Run <code>npm run seed</code> to create your admin account.</li>
              <li>Go to <strong>Credentials</strong> → add your Apify API token (required for all searches).</li>
              <li>Optionally add an AirDNA API token for better STR revenue estimates.</li>
              <li>The Zillow data source is pre-configured — no action needed.</li>
            </ol>

            <h4>Managing Users</h4>
            <p>
              Go to <strong>Users</strong> to create accounts. Grant <strong>"Can run searches"</strong>
              to let non-admin users start their own searches. All users can view results.
            </p>

            <h4>Budget Controls</h4>
            <ul>
              <li><strong>Per-credential limits</strong> — set monthly result caps on each API credential.</li>
              <li><strong>Global budget</strong> — set in Settings to cap total usage across all credentials.</li>
              <li><strong>Hard stop</strong> — when on, searches are rejected if they'd exceed budget.</li>
            </ul>

            <h4>Deal Evaluation Thresholds (Settings page)</h4>
            <ul>
              <li><strong>Cost haircut %</strong> — deducted from STR revenue for expenses/vacancy (default: 25%).</li>
              <li><strong>Min monthly spread</strong> — minimum profit after haircut to qualify as "Good".</li>
              <li><strong>Min revenue-to-rent ratio</strong> — STR revenue ÷ rent must exceed this.</li>
            </ul>
            <p>Changing thresholds re-derives verdicts with no API calls.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
