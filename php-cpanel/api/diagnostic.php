<?php
/** diagnostic.php — recebe as 10 respostas, calcula o PontiScore, guarda e devolve o resultado. */

require __DIR__ . '/lib.php';
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ps_json_out(['error' => 'Método não permitido'], 405);
}

$body = ps_read_json();
$answers = $body['answers'] ?? null;
if (!is_array($answers) || count($answers) === 0) {
    ps_json_out(['error' => 'Respostas em falta'], 400);
}

$map = [];
foreach ($answers as $a) {
    if (!isset($a['question_id'], $a['value'])) {
        ps_json_out(['error' => 'Formato de resposta inválido'], 400);
    }
    $map[(int) $a['question_id']] = $a['value'];
}

try {
    $result = ps_compute($map);
} catch (InvalidArgumentException $e) {
    ps_json_out(['error' => $e->getMessage()], 400);
}

try {
    $pdo = ps_db();
    $stmt = $pdo->prepare(
        'INSERT INTO diagnostics
            (id, total_score, tier, pillar_scores, strengths, weaknesses, recommendations, answers, created_at)
         VALUES
            (:id, :total, :tier, :pillars, :strengths, :weaknesses, :recs, :answers, :created)'
    );
    $stmt->execute([
        ':id'         => $result['id'],
        ':total'      => $result['total_score'],
        ':tier'       => $result['tier'],
        ':pillars'    => json_encode($result['pillar_scores'], JSON_UNESCAPED_UNICODE),
        ':strengths'  => json_encode($result['strengths'], JSON_UNESCAPED_UNICODE),
        ':weaknesses' => json_encode($result['weaknesses'], JSON_UNESCAPED_UNICODE),
        ':recs'       => json_encode($result['recommendations'], JSON_UNESCAPED_UNICODE),
        ':answers'    => json_encode($map, JSON_UNESCAPED_UNICODE),
        ':created'    => gmdate('Y-m-d H:i:s'),
    ]);
} catch (Throwable $e) {
    ps_json_out(['error' => 'Erro ao guardar o diagnóstico'], 500);
}

ps_json_out($result, 200);
