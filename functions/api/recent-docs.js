// GET /api/recent-docs
// Returns recently updated documents from GitHub repository

export async function onRequest(ctx) {
  const { env } = ctx;

  // Configuration
  const REPO = 'eduinside/byeduin-edu-docs';
  const GITHUB_TOKEN = env.GITHUB_TOKEN || '';
  const MAX_RECENT = 3;

  // Response headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  };

  try {
    if (!GITHUB_TOKEN) {
      console.error('[recent-docs] GITHUB_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured', recent: [] }),
        { status: 200, headers }
      );
    }

    // Fetch recent commits
    const commitsRes = await fetch(
      `https://api.github.com/repos/${REPO}/commits?per_page=10`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${GITHUB_TOKEN}`,
          'User-Agent': 'byeduin-labs',
        },
      }
    );

    if (!commitsRes.ok) {
      console.error('[recent-docs] GitHub commits API failed:', commitsRes.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch commits', recent: [] }),
        { status: 200, headers }
      );
    }

    const commits = await commitsRes.json();
    if (!Array.isArray(commits)) {
      return new Response(
        JSON.stringify({ error: 'Invalid commits response', recent: [] }),
        { status: 200, headers }
      );
    }

    // Fetch details for each commit (parallel)
    const detailPromises = commits.slice(0, 5).map(c =>
      fetch(`https://api.github.com/repos/${REPO}/commits/${c.sha}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${GITHUB_TOKEN}`,
          'User-Agent': 'byeduin-labs',
        },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => d ? {
          date: c.commit.committer?.date || new Date().toISOString(),
          files: d.files || [],
        } : null)
        .catch(e => {
          console.error('[recent-docs] Failed to fetch commit detail:', e.message);
          return null;
        })
    );

    const detailResults = await Promise.all(detailPromises);

    // Extract unique .md files (exclude README)
    const seen = new Set();
    const recent = [];

    for (const detail of detailResults) {
      if (!detail) continue;

      for (const file of detail.files) {
        // Only include .md files
        if (!file.filename?.endsWith('.md')) continue;

        // Exclude README.md
        if (file.filename.toLowerCase().endsWith('readme.md')) continue;

        // Skip duplicates
        if (seen.has(file.filename)) continue;

        seen.add(file.filename);
        recent.push({
          path: file.filename,
          date: detail.date,
        });

        if (recent.length >= MAX_RECENT) break;
      }

      if (recent.length >= MAX_RECENT) break;
    }

    return new Response(
      JSON.stringify({ recent }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('[recent-docs] Error:', err.message || err);
    return new Response(
      JSON.stringify({ error: err.message || 'Server error', recent: [] }),
      { status: 500, headers }
    );
  }
}
