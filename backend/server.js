require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ID de afiliado
const AFFILIATE_ID = '18369330491';

// URL do JSON com dados atualizados 
const PRODUCTS_URL = 'https://raw.githubusercontent.com/RiquelmeDevCoders/riquelme-ofertas/main/products.json';

// Rota principal (corrigindo para corresponder ao frontend)
app.get('/', async (req, res) => {
    try {
        const response = await fetch(PRODUCTS_URL);
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar produtos: ${response.status}`);
        }
        
        const data = await response.json();

        // Verificar se existem produtos
        if (!data.products || data.products.length === 0) {
            return res.json({
                products: [],
                lastUpdate: new Date().toLocaleString('pt-BR')
            });
        }

        // Adicionar ID de afiliado aos URLs (se necessário)
        const productsWithAffiliate = data.products.map(product => {
            try {
                const affiliateUrl = new URL(product.url);
                affiliateUrl.searchParams.set('affiliate_id', AFFILIATE_ID);
                return {
                    ...product,
                    url: affiliateUrl.toString()
                };
            } catch (error) {
                // Se houver erro na URL, retorna sem modificar
                return product;
            }
        });

        res.json({
            products: productsWithAffiliate,
            lastUpdate: data.lastUpdate
        });

    } catch (error) {
        console.error('Erro ao obter produtos:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar produtos',
            products: [],
            lastUpdate: new Date().toLocaleString('pt-BR')
        });
    }
});

// Rota adicional para /produtos (mantendo compatibilidade)
app.get('/produtos', async (req, res) => {
    // Redireciona para a rota principal
    req.url = '/';
    app._router.handle(req, res);
});

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Servidor funcionando!', 
        timestamp: new Date().toISOString() 
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});