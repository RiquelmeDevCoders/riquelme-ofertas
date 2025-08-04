require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ID de afiliado
const AFFILIATE_ID = '18369330491';

// URL do JSON com dados atualizados (será preenchido pelo GitHub Actions)
const PRODUCTS_URL = 'https://raw.githubusercontent.com/seu-usuario/riquelme-ofertas/main/products.json';

// Rota principal
app.get('/produtos', async (req, res) => {
    try {
        const response = await fetch(PRODUCTS_URL);
        const data = await response.json();

        // Adicionar ID de afiliado aos URLs
        const productsWithAffiliate = data.products.map(product => {
            const affiliateUrl = new URL(product.url);
            affiliateUrl.searchParams.set('affiliate_id', AFFILIATE_ID);
            return {
                ...product,
                url: affiliateUrl.toString()
            };
        });

        res.json({
            products: productsWithAffiliate,
            lastUpdate: data.lastUpdate
        });

    } catch (error) {
        console.error('Erro ao obter produtos:', error);
        res.status(500).json({ error: 'Erro ao carregar produtos' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
