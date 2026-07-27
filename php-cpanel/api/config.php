<?php
/**
 * config.php — PREENCHA ESTES VALORES no cPanel.
 * (Base de dados MySQL + chave da API do Resend.)
 */
return [
    'db' => [
        'host'    => 'localhost',   // Normalmente "localhost" no cPanel
        'name'    => '',            // Nome da base de dados MySQL (ex.: utilizador_pontiscore)
        'user'    => '',            // Utilizador MySQL
        'pass'    => '',            // Password MySQL
        'charset' => 'utf8mb4',
    ],
    'resend' => [
        // Chave da API do Resend (começa por "re_"). Deixe vazio para desativar o envio.
        'api_key' => '',
        // Remetente — use um endereço num domínio VERIFICADO no Resend.
        'from'    => 'PontiScore <contacto@pontiscore.pt>',
        // Email que recebe a notificação de cada nova lead.
        'admin'   => 'contacto@pontiscore.pt',
    ],
];
