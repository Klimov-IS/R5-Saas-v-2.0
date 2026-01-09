#!/usr/bin/env tsx
/**
 * Script to add new WB stores to the database
 * Usage: npx tsx scripts/add-new-stores.ts
 */

const API_URL = 'http://localhost:9002/api/stores';
const API_KEY = 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
const OWNER_ID = 'default_owner'; // Will be set from API key verification

// New stores data
const NEW_STORES = [
  {
    name: 'ИП Чаевцев Р. Ю.',
    apiToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgzNDQ2NTg4LCJpZCI6IjAxOWI5MWRhLWI1NjgtNzM1OC05MDAwLTRiODY0MDM1YjAwNiIsImlpZCI6MjA1NjU3NTc1LCJvaWQiOjQzNjYwNzUsInMiOjY0Miwic2lkIjoiZmRhYjRlN2ItZTBiMy00N2Y5LTkxNTAtYjljMWNhYjg2ODdkIiwidCI6ZmFsc2UsInVpZCI6MjA1NjU3NTc1fQ.2CRycmb2ZQjGYP81O4gPkam8aY-giiJtcv46QGk-OjrtsHMVv_T-7Iq374OlDXKY9gyp4qbuN7bSSOsOGqd8ZQ'
  },
  {
    name: 'ИП Крылов Б. В.',
    apiToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgzNDc0MzcyLCJpZCI6IjAxOWI5MzgyLWFiNzctNzFmZi05OThkLWQ1NGI1ZjllYzJmYiIsImlpZCI6MjA5NTA1MjkzLCJvaWQiOjI1MDAxODIwNSwicyI6NjQyLCJzaWQiOiJkMzUzNTk5Ni1hNzY5LTRiYjEtYTk4OS0xNWI5NTZhZWNhNGYiLCJ0IjpmYWxzZSwidWlkIjoyMDk1MDUyOTN9.5uRhD-ZhqcWj3_XMW2ik7mL8DuNIJWrVsajB5LjRHHItG2G1U12FyoNAJwXkE4YXJPDV4e_lvPuFPZ616tTNtQ'
  },
  {
    name: 'ИП Крылов Д. Б.',
    apiToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgxOTIwMjc3LCJpZCI6IjAxOWIzNmUxLTBlYjItNzk0My04YTRhLWI4YTRkNjc3NjJiYiIsImlpZCI6MTkxMjQwNzgxLCJvaWQiOjQzOTA3MjgsInMiOjY0Miwic2lkIjoiNzJiNmFlNDItODc0Ni00ZWFjLWIwMTUtMjcwYTQ0YzEzMDllIiwidCI6ZmFsc2UsInVpZCI6MTkxMjQwNzgxfQ.SRz1GdkZNsv4Xdfu7qopN6MaD7et8gKoALFIdI9ftjzvnPIdPubRpSMNu4ew1ZOfzZg4MStlYC5Ga7qQyiO2vw'
  },
  {
    name: 'ИП Русаков Р. А.',
    apiToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgyNTI0MzEwLCJpZCI6IjAxOWI1YWUxLWRlMjUtNzI5OC04NTgzLTJkZjIzOWY0MDhhNSIsImlpZCI6MjAxNjU5MzAsIm9pZCI6MTMxNjAwMCwicyI6NjQyLCJzaWQiOiIwZWMyNTZiZi0zYTJhLTQ1YzUtODY4ZC1lZjY0NDBmODY2NjIiLCJ0IjpmYWxzZSwidWlkIjoyMDE2NTkzMH0.ljlfhUU8jO7b-dl1VYQMojJ5783R-CFBZsOb-96WQAuOp4NjfarY88PyDQdtBPOfOxOevofNaLO0PbosUrUFzw'
  },
  {
    name: 'ИП Русакова Н. Р.',
    apiToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgyNTI0NzM3LCJpZCI6IjAxOWI1YWU4LTYwZjYtNzNiNC1iNTRlLWZmODU4ZGJmZDZkMyIsImlpZCI6MjAxNjU5MzAsIm9pZCI6MTY1NDUwLCJzIjo2NDIsInNpZCI6IjBhMTYyMTg0LTg5ZTctNGY4Yi1hMGMxLWQyNGI5ZjQyNjJhNSIsInQiOmZhbHNlLCJ1aWQiOjIwMTY1OTMwfQ.SckiL6SOfUdcCUccar7YMiT0mkJfD2nXSDjUjGR6EtzUI1IxlHr5_lll8KTvVvVjpYQhOJkn0CwCjOaGJOVjeQ'
  },
  {
    name: 'ИП Тургунов Ф. Ф.',
    apiToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgzMjE5MTI3LCJpZCI6IjAxOWI4NDRiLWYwYzItNzBiNC1hYzI1LWJiNTg2MjUwMmM3NSIsImlpZCI6MjU1MzU3NTM0LCJvaWQiOjI1MDAxMDU2NywicyI6NjQyLCJzaWQiOiI0MjU5NzM2Yy05Yjk4LTRjYmUtOGU1Ny0yOGU4MGEwNGNmNGEiLCJ0IjpmYWxzZSwidWlkIjoyNTUzNTc1MzR9.av9gyi-2lES61NQztYNqvpaso_JEPpHdrlEHQWExNabHJFaxBVp88dgdhrFdAGHcGjAcdPgpaP59Q1zY5lQ4Yg'
  }
];

/**
 * Generate a random 20-character alphanumeric ID (consistent with existing store IDs)
 */
function generateStoreId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Add a single store via API
 */
async function addStore(store: { name: string; apiToken: string }) {
  const id = generateStoreId();

  console.log(`\n🔄 Adding store: ${store.name}`);
  console.log(`   Generated ID: ${id}`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id,
        name: store.name,
        apiToken: store.apiToken,
        contentApiToken: store.apiToken,
        feedbacksApiToken: store.apiToken,
        chatApiToken: store.apiToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Failed: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      return { success: false, id, name: store.name, error: errorText };
    }

    const result = await response.json();
    console.log(`   ✅ Success! Store added with ID: ${id}`);
    return { success: true, id, name: store.name, data: result };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, id, name: store.name, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting to add new WB stores...\n');
  console.log(`📊 Total stores to add: ${NEW_STORES.length}`);
  console.log('─'.repeat(60));

  const results = [];

  for (const store of NEW_STORES) {
    const result = await addStore(store);
    results.push(result);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📈 Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   ✅ Success: ${results.filter(r => r.success).length}`);
  console.log(`   ❌ Failed: ${results.filter(r => !r.success).length}`);

  if (results.some(r => r.success)) {
    console.log('\n✅ Successfully added stores:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.name} (ID: ${r.id})`);
    });
  }

  if (results.some(r => !r.success)) {
    console.log('\n❌ Failed stores:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n🎉 Done!\n');
}

// Run the script
main().catch(console.error);
