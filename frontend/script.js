// URL do backend hospedado no Render
const BACKEND_URL = 'https://riquelme-ofertas.onrender.com';
const COLD_START_TIMEOUT = 60000; // 60 segundos para cold start

// Função para mostrar loading específico para cold start
function showColdStartLoading() {
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = `
        <div class="cold-start-loading">
            <div class="spinner-container">
                <div class="spinner"></div>
                <div class="server-icon">🌐</div>
            </div>
            <h3>🔄 Servidor Inicializando...</h3>
            <p>O servidor estava em modo de economia de energia e está sendo reativado.</p>
            <p>Este processo pode levar até <strong>60 segundos</strong> na primeira visita.</p>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
            </div>
            <p class="loading-tip">💡 <em>Dica: Próximas visitas serão muito mais rápidas!</em></p>
        </div>
    `;
    
    // Animação da barra de progresso
    let progress = 0;
    const progressBar = document.getElementById('progress-fill');
    const interval = setInterval(() => {
        progress += 2;
        if (progressBar) {
            progressBar.style.width = Math.min(progress, 95) + '%';
        }
        if (progress >= 100) {
            clearInterval(interval);
        }
    }, 1200); // 60 segundos total
}

// Função para mostrar loading normal
function showNormalLoading() {
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <h3>Carregando ofertas...</h3>
            <p>Buscando as melhores ofertas para você!</p>
        </div>
    `;
}

// Função para obter badge da plataforma
function getPlatformBadge(platform) {
    const platforms = {
        shopee: { name: 'Shopee', color: '#FF6B35', icon: '🛒' },
        mercadolivre: { name: 'Mercado Livre', color: '#FFE500', icon: '🏪' },
        amazon: { name: 'Amazon', color: '#FF9900', icon: '📦' },
        aliexpress: { name: 'AliExpress', color: '#FF4747', icon: '🌐' }
    };
    
    const platformInfo = platforms[platform] || { name: platform, color: '#6c757d', icon: '🏷️' };
    
    return `
        <span class="platform-badge" style="background-color: ${platformInfo.color}20; color: ${platformInfo.color}; border: 1px solid ${platformInfo.color}40;">
            ${platformInfo.icon} ${platformInfo.name}
        </span>
    `;
}

// Função melhorada para carregar produtos
async function loadProducts() {
    const productsContainer = document.getElementById('products-container');

    try {
        console.log('🔄 Carregando produtos...');
        
        // Detectar se é provavelmente um cold start
        const isLikelyColdStart = !window.serverWarmCache;
        
        if (isLikelyColdStart) {
            showColdStartLoading();
        } else {
            showNormalLoading();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), COLD_START_TIMEOUT);

        const response = await fetch(BACKEND_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        window.serverWarmCache = true; // Marcar servidor como "quente"

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📦 Dados recebidos:', data);

        // Atualizar informações da página
        updatePageInfo(data);

        // Verificar se há produtos
        if (!data.products || data.products.length === 0) {
            showNoProducts();
            return;
        }

        // Renderizar produtos
        renderProducts(data.products);

        console.log(`✅ ${data.products.length} produtos carregados com sucesso!`);

    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        
        if (error.name === 'AbortError') {
            showTimeoutError();
        } else {
            showError(error.message);
        }
    }
}

// Função para atualizar informações da página
function updatePageInfo(data) {
    // Atualizar data de atualização
    const updateDateElement = document.getElementById('update-date');
    if (updateDateElement && data.lastUpdate) {
        updateDateElement.textContent = data.lastUpdate;
    }
    
    // Atualizar contador de produtos
    const productCountElement = document.getElementById('product-count');
    if (productCountElement && data.totalProducts) {
        productCountElement.textContent = `${data.totalProducts} ofertas disponíveis`;
    }
    
    // Mostrar estatísticas das plataformas
    const platformStatsElement = document.getElementById('platform-stats');
    if (platformStatsElement && data.platforms) {
        const platformsHtml = Object.entries(data.platforms)
            .map(([platform, count]) => `
                <span class="platform-stat">
                    ${getPlatformBadge(platform)} ${count}
                </span>
            `).join('');
        
        platformStatsElement.innerHTML = `
            <div class="platforms-summary">
                <h4>📊 Produtos por Plataforma:</h4>
                <div class="platform-stats-grid">${platformsHtml}</div>
            </div>
        `;
    }
}

// Função para renderizar produtos
function renderProducts(products) {
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = '';

    products.forEach((product, index) => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        // Adicionar classe especial para produtos da Shopee (com afiliado)
        if (product.platform === 'shopee') {
            productCard.classList.add('affiliate-product');
        }

        productCard.innerHTML = `
            <div class="product-header">
                ${getPlatformBadge(product.platform)}
                ${product.discount ? `<span class="product-discount">${product.discount}</span>` : ''}
            </div>
            <img src="${product.image}" alt="${product.title}" class="product-image" 
                 onerror="this.src='https://via.placeholder.com/200x200/f8f9fa/6c757d?text=Sem+Imagem'"
                 loading="lazy">
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <div class="product-price">${product.price}</div>
                <a href="${product.url}" target="_blank" rel="noopener noreferrer" class="affiliate-btn">
                    ${product.platform === 'shopee' ? '🎯 Ver Oferta (Afiliado)' : '🔗 Ver Oferta'}
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;

        // Adicionar animação com delay
        productCard.style.animationDelay = `${index * 0.1}s`;
        productsContainer.appendChild(productCard);
    });
}

// Função para mostrar quando não há produtos
function showNoProducts() {
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = `
        <div class="no-products">
            <i class="fas fa-search"></i>
            <h3>Nenhuma oferta disponível no momento</h3>
            <p>Estamos buscando as melhores ofertas para você. Volte em breve!</p>
            <button onclick="loadProducts()" class="retry-btn">
                <i class="fas fa-redo"></i> Buscar Novamente
            </button>
        </div>
    `;
}

// Função para mostrar erro de timeout
function showTimeoutError() {
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = `
        <div class="error timeout-error">
            <i class="fas fa-clock"></i>
            <h3>Servidor Demorou Para Responder</h3>
            <p>O servidor está demorando mais que o esperado para inicializar.</p>
            <p>Isso é normal na primeira visita do dia devido ao modo de economia de energia.</p>
            <div class="error-actions">
                <button onclick="loadProducts()" class="retry-btn primary">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
                <button onclick="window.location.reload()" class="retry-btn">
                    <i class="fas fa-refresh"></i> Recarregar Página
                </button>
            </div>
            <p class="error-tip">💡 <em>Dica: Aguarde alguns segundos e tente novamente</em></p>
        </div>
    `;
}

// Função para mostrar erro genérico
function showError(errorMessage) {
    const productsContainer = document.getElementById('products-container');
    productsContainer.innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Ops! Algo deu errado</h3>
            <p>Não foi possível carregar as ofertas no momento.</p>
            <details class="error-details">
                <summary>Detalhes do erro</summary>
                <p><code>${errorMessage}</code></p>
            </details>
            <div class="error-actions">
                <button onclick="loadProducts()" class="retry-btn primary">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
                <button onclick="checkServerStatus()" class="retry-btn">
                    <i class="fas fa-heartbeat"></i> Verificar Servidor
                </button>
            </div>
        </div>
    `;
}

// Função para testar conexão com o backend
async function testBackend() {
    try {
        console.log('🔗 Testando conexão com backend...');
        const response = await fetch(`${BACKEND_URL}/test`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30000) // 30s timeout para teste
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Backend conectado:', data);
        return { ok: true, data };
    } catch (error) {
        console.error('❌ Backend não está respondendo:', error);
        return { ok: false, error: error.message };
    }
}

// Função para verificar status do servidor
async function checkServerStatus() {
    const productsContainer = document.getElementById('products-container');
    
    productsContainer.innerHTML = `
        <div class="server-check">
            <div class="spinner"></div>
            <h3>Verificando Status do Servidor...</h3>
            <p>Aguarde enquanto testamos a conexão...</p>
        </div>
    `;
    
    const result = await testBackend();
    
    if (result.ok) {
        productsContainer.innerHTML = `
            <div class="server-check success">
                <i class="fas fa-check-circle"></i>
                <h3>✅ Servidor Online!</h3>
                <p>Conexão estabelecida com sucesso.</p>
                <p><strong>Versão:</strong> ${result.data.nodeVersion}</p>
                <p><strong>Plataformas:</strong> ${result.data.supportedPlatforms?.join(', ')}</p>
                <button onclick="loadProducts()" class="retry-btn primary">
                    <i class="fas fa-download"></i> Carregar Ofertas
                </button>
            </div>
        `;
    } else {
        productsContainer.innerHTML = `
            <div class="server-check error">
                <i class="fas fa-times-circle"></i>
                <h3>❌ Servidor Indisponível</h3>
                <p>Não foi possível conectar ao servidor.</p>
                <p><strong>Erro:</strong> ${result.error}</p>
                <div class="error-actions">
                    <button onclick="loadProducts()" class="retry-btn">
                        <i class="fas fa-redo"></i> Tentar Carregar Mesmo Assim
                    </button>
                    <button onclick="window.location.reload()" class="retry-btn">
                        <i class="fas fa-refresh"></i> Recarregar Página
                    </button>
                </div>
            </div>
        `;
    }
}

// Função para buscar produtos por plataforma
async function loadProductsByPlatform(platform) {
    try {
        showNormalLoading();
        
        const response = await fetch(`${BACKEND_URL}/platform/${platform}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.products && data.products.length > 0) {
            renderProducts(data.products);
            console.log(`✅ ${data.products.length} produtos da ${platform} carregados`);
        } else {
            showNoProducts();
        }
    } catch (error) {
        console.error(`❌ Erro ao carregar produtos da ${platform}:`, error);
        showError(error.message);
    }
}

// Função para buscar produtos
async function searchProducts(query) {
    if (!query || query.trim().length < 2) {
        alert('Digite pelo menos 2 caracteres para buscar');
        return;
    }
    
    try {
        showNormalLoading();
        
        const response = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.products && data.products.length > 0) {
            renderProducts(data.products);
            console.log(`🔍 ${data.products.length} produtos encontrados para "${query}"`);
        } else {
            const productsContainer = document.getElementById('products-container');
            productsContainer.innerHTML = `
                <div class="no-products">
                    <i class="fas fa-search"></i>
                    <h3>Nenhum produto encontrado</h3>
                    <p>Não encontramos produtos para "<strong>${query}</strong>"</p>
                    <button onclick="loadProducts()" class="retry-btn">
                        <i class="fas fa-list"></i> Ver Todas as Ofertas
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error(`❌ Erro na busca por "${query}":`, error);
        showError(error.message);
    }
}

// Inicialização quando a página carregar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Página carregada, iniciando sistema multi-plataforma...');
    
    // Configurar event listeners se existirem elementos de UI
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', () => {
            searchProducts(searchInput.value);
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchProducts(searchInput.value);
            }
        });
    }
    
    // Configurar filtros de plataforma se existirem
    const platformFilters = document.querySelectorAll('.platform-filter');
    platformFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            const platform = filter.dataset.platform;
            if (platform === 'all') {
                loadProducts();
            } else {
                loadProductsByPlatform(platform);
            }
        });
    });
    
    // Carregar produtos inicialmente
    await loadProducts();
});

// Função para manter servidor ativo (opcional - chama a cada 14 minutos)
function keepServerAlive() {
    setInterval(async () => {
        try {
            await fetch(`${BACKEND_URL}/test`, { method: 'HEAD' });
            console.log('🏃‍♂️ Keep-alive ping enviado');
        } catch (error) {
            console.log('⚠️ Keep-alive falhou:', error.message);
        }
    }, 14 * 60 * 1000); // 14 minutos
}

// Atualizar produtos automaticamente a cada 30 minutos
setInterval(async () => {
    console.log('🔄 Atualizando produtos automaticamente...');
    if (window.serverWarmCache) {
        await loadProducts();
    }
}, 30 * 60 * 1000); // 30 minutos

// Exportar funções globais
window.loadProducts = loadProducts;
window.searchProducts = searchProducts;
window.loadProductsByPlatform = loadProductsByPlatform;
window.checkServerStatus = checkServerStatus;
window.keepServerAlive = keepServerAlive;

// Iniciar keep-alive automaticamente
keepServerAlive();