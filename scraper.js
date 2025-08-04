const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Configurações
const SHOPEE_URL = 'https://shoppe.com.br/search?category=0&facet=157&page=';
const MAX_PAGES = 3;
const PRODUCTS_LIMIT = 30;

async function scrapeShopee() {
    let allProducts = [];

    for (let page = 0; page < MAX_PAGES; page++) {
        try {
            const response = await fetch(`${SHOPEE_URL}${page}`);
            const html = await response.text();
            const $ = cheerio.load(html);

            $('.product-item').each((i, el) => {
                if (allProducts.length >= PRODUCTS_LIMIT) return;

                const $el = $(el);
                const title = $el.find('.product-title').text().trim();
                const price = $el.find('.product-price').text().trim();
                const image = $el.find('.product-image img').attr('src');
                const url = $el.find('a.product-link').attr('href');
                const discount = $el.find('.discount-percentage').text().trim();

                if (title && price && image && url) {
                    allProducts.push({
                        title,
                        price,
                        image,
                        url: `https://shoppe.com.br${url}`,
                        discount
                    });
                }
            });

        } catch (error) {
            console.error(`Erro na página ${page}:`, error);
        }
    }

    return allProducts.slice(0, PRODUCTS_LIMIT);
}

async function main() {
    try {
        const products = await scrapeShopee();
        const now = new Date();
        const lastUpdate = now.toLocaleString('pt-BR', {
            dateStyle: 'full',
            timeStyle: 'medium'
        });

        const data = {
            lastUpdate,
            products
        };

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
        console.log(`✅ ${products.length} produtos salvos!`);

    } catch (error) {
        console.error('Erro no scraping:', error);
        process.exit(1);
    }
}

main();
