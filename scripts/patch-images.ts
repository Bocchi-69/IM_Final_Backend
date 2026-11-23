import { db } from '../src/db';
import { products } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function patch() {
  console.log('Patching product images...');
  
  // Fix product 18 (HTML url -> actual chocolate ice cream image)
  await db.update(products)
    .set({ imagePath: 'products/bddc8d3cf0fd7ba9f71aae10c8a0d9f040a0ae5f.jpg' })
    .where(eq(products.id, 18));
  console.log('Fixed product 18 imagePath');

  // Fix product 52 (broken hash -> existing fried chicken image)
  await db.update(products)
    .set({ imagePath: 'products/2091c8e1bee3c9804191cf41ddc4743014486a46.jpg' })
    .where(eq(products.id, 52));
  console.log('Fixed product 52 imagePath');

  console.log('Patch completed successfully!');
  process.exit(0);
}

patch().catch(err => {
  console.error('Failed to patch images:', err);
  process.exit(1);
});
