import { db } from '../src/db';
import { products } from '../src/db/schema';

async function run() {
  const all = await db.select().from(products);
  console.log(JSON.stringify(all.map(p => ({ id: p.id, name: p.name, imagePath: p.imagePath })), null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
