// URL do backend hospedado no Render
const BACKEND_URL = 'https://riquelme-ofertas.onrender.com';

async function loadProducts() {
    const productsContainer = document.getElementById('products-container');

    try {
        console.log('🔄 Carregando produtos...');

        const response = await fetch(BACKEND_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📦 Dados recebidos:', data);

        // Atualizar data de atualização
        const updateDateElement = document.getElementById('update-date');
        if (updateDateElement && data.lastUpdate) {
            updateDateElement.textContent = data.lastUpdate;
        }

        // Verificar se há produtos
        if (!data.products || data.products.length === 0) {
            productsContainer.innerHTML = `
                <div class="no-products">
                    <i class="fas fa-search"></i>
                    <h3>Nenhuma oferta disponível no momento</h3>
                    <p>Estamos buscando as melhores ofertas para você. Volte em breve!</p>
                </div>
            `;
            return;
        }

        // Limpar container
        productsContainer.innerHTML = '';

        // Criar cards dos produtos
        data.products.forEach((product, index) => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';

            // Corrigir template string (era o erro principal!)
            productCard.innerHTML = `
                <img src="${product.image}" alt="${product.title}" class="product-image" 
                     onerror="this.src='https://via.placeholder.com/200x200?text=Sem+Imagem'">
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-price">${product.price}</div>
                    ${product.discount ? `<span class="product-discount">${product.discount}</span>` : ''}
                    <a href="${product.url}" target="_blank" class="affiliate-btn">
                        Ver Oferta <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            `;

            // Adicionar animação com delay
            productCard.style.animationDelay = `${index * 0.1}s`;
            productsContainer.appendChild(productCard);
        });

        console.log(`✅ ${data.products.length} produtos carregados com sucesso!`);

    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);

        productsContainer.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ops! Algo deu errado</h3>
                <p>Não foi possível carregar as ofertas no momento.</p>
                <p><small>Erro: ${error.message}</small></p>
                <button onclick="loadProducts()" class="retry-btn">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
            </div>
        `;
    }
}

// Função para testar conexão com o backend
async function testBackend() {
    try {
        const response = await fetch(`${BACKEND_URL}/test`);
        const data = await response.json();
        console.log('🔗 Teste de conexão:', data);
        return true;
    } catch (error) {
        console.error('❌ Backend não está respondendo:', error);
        return false;
    }
}

// Carregar produtos quando a página carregar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Página carregada, iniciando...');

    // Testar backend primeiro
    const backendOk = await testBackend();
    if (!backendOk) {
        document.getElementById('products-container').innerHTML = `
            <div class="error">
                <i class="fas fa-server"></i>
                <h3>Servidor Temporariamente Indisponível</h3>
                <p>Nosso servidor está reinicializando. Aguarde alguns minutos e recarregue a página.</p>
                <button onclick="window.location.reload()" class="retry-btn">
                    <i class="fas fa-redo"></i> Recarregar Página
                </button>
            </div>
        `;
        return;
    }

    // Carregar produtos
    await loadProducts();
});

// Atualizar produtos a cada 10 minutos
setInterval(async () => {
    console.log('🔄 Atualizando produtos automaticamente...');
    await loadProducts();
}, 600000);

// Função para forçar atualização (pode ser chamada pelo usuário)
window.forceUpdate = loadProducts;