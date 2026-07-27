<?php
/**
 * lib.php — lógica de negócio do PontiScore (espelha exatamente o backend original).
 * Questões, pilares, scoring, tiers e recomendações.
 */

const PS_SCORE_MAP = ['sim' => 10, 'grande_parte' => 7, 'parcialmente' => 4, 'nao' => 0];

function ps_questions()
{
    return [
        ['id' => 1,  'text' => 'Publica conteúdos pelo menos 3 vezes por semana?',                  'pillar' => 'frequencia'],
        ['id' => 2,  'text' => 'Publica stories diariamente?',                                       'pillar' => 'frequencia'],
        ['id' => 3,  'text' => 'Os seus reels ultrapassam as 2000 visualizações?',                   'pillar' => 'alcance'],
        ['id' => 4,  'text' => 'Mede quantos clientes chegam através das redes sociais?',            'pillar' => 'planeamento'],
        ['id' => 5,  'text' => 'Tem uma estratégia de conteúdos definida?',                          'pillar' => 'estrategia'],
        ['id' => 6,  'text' => 'Investe em anúncios pagos nas redes sociais?',                       'pillar' => 'estrategia'],
        ['id' => 7,  'text' => 'A sua identidade visual é consistente em todas as publicações?',     'pillar' => 'identidade'],
        ['id' => 8,  'text' => 'As suas publicações têm sempre uma chamada para ação (CTA)?',        'pillar' => 'planeamento'],
        ['id' => 9,  'text' => 'Segue um calendário editorial planeado?',                            'pillar' => 'planeamento'],
        ['id' => 10, 'text' => 'Responde rapidamente às mensagens e comentários?',                   'pillar' => 'alcance'],
    ];
}

function ps_pillars()
{
    return [
        'frequencia'  => ['label' => 'Frequência & Consistência', 'questions' => [1, 2]],
        'alcance'     => ['label' => 'Alcance & Performance',      'questions' => [3, 10]],
        'estrategia'  => ['label' => 'Estratégia & Investimento',  'questions' => [5, 6]],
        'identidade'  => ['label' => 'Identidade Visual',          'questions' => [7]],
        'planeamento' => ['label' => 'Planeamento & Conversão',    'questions' => [4, 8, 9]],
    ];
}

function ps_recommendations()
{
    return [
        'frequencia' => [
            'low'  => 'Crie um calendário semanal com 3 publicações fixas + stories diários para construir consistência.',
            'mid'  => 'Mantenha o ritmo atual e teste um formato novo por semana (carrossel ou reel).',
            'high' => 'Excelente cadência. Foque agora em elevar a qualidade e o storytelling em cada peça.',
        ],
        'alcance' => [
            'low'  => 'Publique vídeos curtos com uma introdução apelativa nos primeiros 3 segundos e responda rapidamente aos comentários e mensagens para aumentar o alcance e o envolvimento da audiência.',
            'mid'  => 'Otimize os horários de publicação e teste hashtags e temas de tendência relevantes para o seu nicho.',
            'high' => 'Alcance saudável. Escale com colaborações e campanhas pagas para amplificar resultados.',
        ],
        'estrategia' => [
            'low'  => 'Defina objetivos SMART e um funil claro (topo, meio, fundo). Comece a testar anúncios com 5 a 10 euros por dia.',
            'mid'  => 'Já tem base. Estruture uma estratégia trimestral com KPIs e um orçamento dedicado a anúncios.',
            'high' => 'Estratégia sólida. Escale o investimento com base no ROAS e em testes A/B contínuos.',
        ],
        'identidade' => [
            'low'  => 'Crie um mini brandbook com a paleta de cores, tipografia, tom de voz e regras de estilo. Aplique esta identidade visual de forma consistente em todos os ecrãs e templates da aplicação.',
            'mid'  => 'Refine os templates e alinhe fotografias e vídeos com a identidade visual definida.',
            'high' => 'Identidade forte. Considere uma evolução subtil para se destacar da concorrência.',
        ],
        'planeamento' => [
            'low'  => 'Crie um calendário editorial, adicione parâmetros UTM a todos os links das publicações para medir o desempenho das campanhas e inclua uma chamada para ação (CTA) clara e consistente em cada publicação.',
            'mid'  => 'Adicione medição de conversão por canal e refine as CTAs consoante o objetivo de cada publicação.',
            'high' => 'Planeamento maduro. Automatize relatórios mensais para escalar decisões com dados.',
        ],
    ];
}

/** Calcula o resultado a partir do mapa {question_id => value}. */
function ps_compute(array $answerMap)
{
    $scores = [];
    foreach (ps_questions() as $q) {
        $v = $answerMap[$q['id']] ?? null;
        if (!array_key_exists($v, PS_SCORE_MAP)) {
            throw new InvalidArgumentException("Resposta inválida para a pergunta {$q['id']}");
        }
        $scores[$q['id']] = PS_SCORE_MAP[$v];
    }

    $total = array_sum($scores); // 0-100

    $pillarScores = [];
    foreach (ps_pillars() as $key => $meta) {
        $raw = 0;
        foreach ($meta['questions'] as $qid) {
            $raw += $scores[$qid];
        }
        $maxRaw = count($meta['questions']) * 10;
        $norm = $maxRaw ? (int) round($raw / $maxRaw * 100) : 0;
        $pillarScores[] = [
            'key' => $key, 'label' => $meta['label'],
            'score' => $norm, 'raw' => $raw, 'max_raw' => $maxRaw,
        ];
    }

    if ($total >= 80)      $tier = 'Presença digital de excelência';
    elseif ($total >= 60)  $tier = 'Boa presença com espaço para escalar';
    elseif ($total >= 40)  $tier = 'Presença em construção';
    else                   $tier = 'Presença digital frágil — agir agora';

    $strengths = [];
    $weaknesses = [];
    $recommendations = [];
    $recs = ps_recommendations();
    foreach ($pillarScores as $p) {
        if ($p['score'] >= 70) $strengths[] = $p['label'];
        if ($p['score'] < 50)  $weaknesses[] = $p['label'];
        if ($p['score'] < 50)      $level = 'low';
        elseif ($p['score'] < 75)  $level = 'mid';
        else                       $level = 'high';
        $recommendations[] = $p['label'] . ': ' . $recs[$p['key']][$level];
    }

    return [
        'id'              => ps_uuid4(),
        'total_score'     => $total,
        'tier'            => $tier,
        'pillar_scores'   => $pillarScores,
        'strengths'       => $strengths,
        'weaknesses'      => $weaknesses,
        'recommendations' => $recommendations,
        'created_at'      => gmdate('c'),
    ];
}

// ---------- helpers ----------
function ps_uuid4()
{
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

function ps_json_out($data, int $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ps_read_json()
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
