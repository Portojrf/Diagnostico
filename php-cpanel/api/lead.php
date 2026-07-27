<?php
/** lead.php — guarda a lead (RGPD) e envia o relatório completo por email (HTML) via Resend. */

require __DIR__ . '/lib.php';
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ps_json_out(['error' => 'Método não permitido'], 405);
}

$b = ps_read_json();
$name    = trim((string) ($b['name'] ?? ''));
$company = trim((string) ($b['company'] ?? ''));
$email   = trim((string) ($b['email'] ?? ''));
$phone   = trim((string) ($b['phone'] ?? ''));
$diagId  = (string) ($b['diagnostic_id'] ?? '');
$privacy = !empty($b['privacy_accepted']);
$marketing = !empty($b['marketing_accepted']);

// Validação (RGPD: privacidade é obrigatória)
if ($name === '' || $company === '') {
    ps_json_out(['error' => 'Nome e empresa são obrigatórios'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ps_json_out(['error' => 'Email inválido'], 422);
}
if (!$privacy) {
    ps_json_out(['error' => 'Deve aceitar a Política de Privacidade'], 422);
}
if ($diagId === '') {
    ps_json_out(['error' => 'Diagnóstico em falta'], 400);
}

try {
    $pdo = ps_db();
    $row = $pdo->prepare('SELECT * FROM diagnostics WHERE id = :id');
    $row->execute([':id' => $diagId]);
    $diag = $row->fetch();
    if (!$diag) {
        ps_json_out(['error' => 'Diagnóstico não encontrado'], 404);
    }

    $result = [
        'id'              => $diag['id'],
        'total_score'     => (int) $diag['total_score'],
        'tier'            => $diag['tier'],
        'pillar_scores'   => json_decode($diag['pillar_scores'], true) ?: [],
        'strengths'       => json_decode($diag['strengths'], true) ?: [],
        'weaknesses'      => json_decode($diag['weaknesses'], true) ?: [],
        'recommendations' => json_decode($diag['recommendations'], true) ?: [],
    ];

    $leadId    = ps_uuid4();
    $consentAt = gmdate('Y-m-d H:i:s');

    // O envio de email nunca deve bloquear o registo da lead.
    $emailSent = false;
    try {
        $emailSent = ps_send_emails($name, $company, $email, $phone, $result);
    } catch (Throwable $e) {
        $emailSent = false;
    }

    $ins = $pdo->prepare(
        'INSERT INTO leads
            (id, name, company, email, phone, diagnostic_id, privacy_accepted, marketing_accepted, consent_at, email_sent, created_at)
         VALUES
            (:id, :name, :company, :email, :phone, :diag, :priv, :mkt, :consent, :sent, :created)'
    );
    $ins->execute([
        ':id'      => $leadId,
        ':name'    => $name,
        ':company' => $company,
        ':email'   => $email,
        ':phone'   => $phone !== '' ? $phone : null,
        ':diag'    => $diagId,
        ':priv'    => $privacy ? 1 : 0,
        ':mkt'     => $marketing ? 1 : 0,
        ':consent' => $consentAt,
        ':sent'    => $emailSent ? 1 : 0,
        ':created' => gmdate('Y-m-d H:i:s'),
    ]);

    ps_json_out(['id' => $leadId, 'email_sent' => $emailSent], 200);
} catch (Throwable $e) {
    ps_json_out(['error' => 'Erro ao processar a lead'], 500);
}

// -------------------------------------------------------------------------

function ps_send_emails($name, $company, $email, $phone, array $result)
{
    $cfg = ps_config()['resend'];
    $key = trim((string) $cfg['api_key']);
    if (strpos($key, 're_') !== 0) {
        return false; // chave não configurada → não envia (lead na mesma é guardada)
    }

    $reportHtml = ps_report_email_html($name, $result);
    $ok1 = ps_resend_send($key, $cfg['from'], $email,
        'O seu Relatório PontiScore (' . $result['total_score'] . '/100)', $reportHtml);

    $adminHtml = ps_admin_email_html($name, $company, $email, $phone, $result);
    ps_resend_send($key, $cfg['from'], $cfg['admin'],
        'Nova lead PontiScore: ' . $company . ' (' . $result['total_score'] . '/100)', $adminHtml);

    return $ok1;
}

function ps_resend_send($key, $from, $to, $subject, $html)
{
    $payload = json_encode([
        'from' => $from, 'to' => [$to], 'subject' => $subject, 'html' => $html,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => $payload,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}

function ps_report_email_html($name, array $r)
{
    $e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    $pillars = '';
    foreach ($r['pillar_scores'] as $p) {
        $pillars .=
            '<tr>'
            . '<td style="padding:8px 0;font-size:14px;color:#0F172A">' . $e($p['label']) . '</td>'
            . '<td style="padding:8px 0;text-align:right;font-weight:700;color:#1B3A8B">' . (int) $p['score'] . '/100</td>'
            . '</tr>';
    }
    $lst = function ($items, $empty) use ($e) {
        if (!$items) return '<li style="color:#475569">' . $e($empty) . '</li>';
        $o = '';
        foreach ($items as $i) $o .= '<li style="margin-bottom:4px">' . $e($i) . '</li>';
        return $o;
    };
    $recs = '';
    $n = 1;
    foreach ($r['recommendations'] as $rec) {
        $recs .= '<p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#0F172A"><strong style="color:#1B3A8B">' . $n++ . '.</strong> ' . $e($rec) . '</p>';
    }

    return
    '<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#0F172A">'
    . '<div style="background:#1B3A8B;padding:28px 24px;text-align:center">'
        . '<h1 style="margin:0;color:#fff;font-size:22px">PontiScore</h1>'
        . '<p style="margin:6px 0 0;color:#BBD0F5;font-size:13px">O seu Diagnóstico Digital</p>'
    . '</div>'
    . '<div style="padding:28px 24px">'
        . '<p style="font-size:15px">Olá <strong>' . $e($name) . '</strong>,</p>'
        . '<p style="font-size:15px;line-height:1.6;color:#475569">Obrigado por concluir o seu diagnóstico PontiScore. Aqui está o seu relatório completo:</p>'
        . '<div style="text-align:center;margin:24px 0;padding:20px;background:#EEF2FA;border-radius:12px">'
            . '<div style="font-size:48px;font-weight:800;color:#1B3A8B;line-height:1">' . (int) $r['total_score'] . '<span style="font-size:20px;color:#475569">/100</span></div>'
            . '<div style="font-size:15px;color:#475569;margin-top:6px">' . $e($r['tier']) . '</div>'
        . '</div>'
        . '<h2 style="font-size:16px;color:#0F172A;margin:24px 0 8px">Pontuação por Pilar</h2>'
        . '<table style="width:100%;border-collapse:collapse;border-top:1px solid #E2E8F0">' . $pillars . '</table>'
        . '<h2 style="font-size:16px;color:#0F172A;margin:24px 0 8px">Pontos Fortes</h2>'
        . '<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#0F172A">' . $lst($r['strengths'], 'Ainda sem pontos fortes destacados.') . '</ul>'
        . '<h2 style="font-size:16px;color:#0F172A;margin:24px 0 8px">Oportunidades de Melhoria</h2>'
        . '<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#0F172A">' . $lst($r['weaknesses'], 'Sem pontos críticos.') . '</ul>'
        . '<h2 style="font-size:16px;color:#0F172A;margin:24px 0 8px">Recomendações Personalizadas</h2>'
        . $recs
        . '<div style="margin-top:24px;padding:18px;background:#DCFCE7;border-radius:12px">'
            . '<p style="margin:0;font-size:14px;line-height:1.6;color:#15803D">A nossa equipa entrará em contacto brevemente para agendar a sua <strong>Sessão Estratégica gratuita</strong> + Plano de Crescimento Personalizado.</p>'
        . '</div>'
    . '</div>'
    . '<div style="padding:18px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;font-size:12px;color:#475569">© ' . date('Y') . ' PontiScore · contacto@pontiscore.pt</div>'
    . '</div>';
}

function ps_admin_email_html($name, $company, $email, $phone, array $r)
{
    $e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    return
    '<div style="font-family:Inter,Helvetica,Arial,sans-serif;color:#0F172A">'
    . '<h2 style="color:#1B3A8B">Nova lead PontiScore</h2>'
    . '<ul style="font-size:14px;line-height:1.7">'
        . '<li><strong>Nome:</strong> ' . $e($name) . '</li>'
        . '<li><strong>Empresa:</strong> ' . $e($company) . '</li>'
        . '<li><strong>Email:</strong> ' . $e($email) . '</li>'
        . '<li><strong>Telefone:</strong> ' . ($phone !== '' ? $e($phone) : '-') . '</li>'
        . '<li><strong>PontiScore:</strong> ' . (int) $r['total_score'] . '/100 (' . $e($r['tier']) . ')</li>'
    . '</ul>'
    . '</div>';
}
