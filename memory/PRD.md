# PontiScore — PRD (versão PHP + MySQL para cPanel)

## Estado atual
O projeto foi **convertido para HTML + CSS + JavaScript + PHP puro + MySQL**, a pedido do
utilizador, para correr em alojamento cPanel/PTISP (sem Python/Node/Composer/build).
O stack anterior (React Vite + FastAPI + MongoDB) foi **removido** de `/app` (backend/ e
frontend/ apagados; serviços supervisor parados).

## Entregável
Pasta `/app/php-cpanel/` (arrastar para `public_html/` no cPanel):
- `index.html` — SPA em vanilla JS (Landing, Questionário, Dashboard, Obrigado)
- `privacidade.html`, `termos.html` — páginas legais
- `assets/` — `styles.css` (identidade visual original), `app.js`, `logo-pontiscore.png`, `favicon.svg`
- `api/` — `config.php` (a preencher), `db.php` (PDO), `lib.php` (scoring), `diagnostic.php`, `lead.php`
- `sql/schema.sql` — tabelas `diagnostics` e `leads`
- `LEIA-ME-cPanel.txt` — instruções de instalação

## Lógica de negócio (preservada, paridade verificada)
- 10 perguntas → scoring 0–100 (sim=10/grande_parte=7/parcialmente=4/nao=0), 5 pilares normalizados.
- Tiers: ≥80 excelência, ≥60 boa, ≥40 construção, <40 frágil. Fortes ≥70, fracos <50, recs low<50/mid<75/high.
- Estatísticas mostradas no ecrã logo após a 10.ª pergunta (`diagnostic.php`).
- Relatório completo enviado por **email HTML (Resend)** apenas após o formulário (`lead.php`), com consentimento RGPD obrigatório (422 sem privacidade).

## Integrações
- **MySQL** via PDO (config em `api/config.php`).
- **Resend** via cURL (email HTML rico, sem anexo). Chave em `config.php` (vazia → leads gravadas, `email_sent=false`).

## Validação feita (2026)
- `php -l` OK em todos os ficheiros PHP.
- Paridade de scoring PHP vs Python confirmada (all-sim=100/excelência, all-nao=0/frágil, misto=50).
- CSS/DOM reutilizados verbatim do frontend React → identidade visual idêntica.
- NÃO validado neste ambiente: endpoints PHP com MySQL (sem servidor MySQL nem extensões pdo_mysql/curl no PHP CLI local). A validar no cPanel.

## Próximos passos (utilizador)
1. Criar BD MySQL + importar `sql/schema.sql` (phpMyAdmin).
2. Preencher `api/config.php` (MySQL + Resend).
3. Arrastar `php-cpanel/` para `public_html/`.
4. "Save to GitHub" para versionar.
