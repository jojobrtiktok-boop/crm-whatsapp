import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save, ArrowLeft, MessageSquare, Image, Mic, Video,
  List, Clock, GitBranch, Bot, Receipt, Tag, ArrowRightLeft,
} from 'lucide-react';
import api from '../api';

// Tipos de blocos disponíveis
const TIPOS_BLOCOS = [
  { type: 'texto', label: 'Texto', icon: MessageSquare, cor: '#3b82f6' },
  { type: 'imagem', label: 'Imagem', icon: Image, cor: '#8b5cf6' },
  { type: 'audio', label: 'Áudio', icon: Mic, cor: '#ec4899' },
  { type: 'video', label: 'Vídeo', icon: Video, cor: '#f59e0b' },
  { type: 'botoes', label: 'Botões', icon: List, cor: '#22c55e' },
  { type: 'delay', label: 'Delay', icon: Clock, cor: '#6b7280' },
  { type: 'condicao', label: 'Condição', icon: GitBranch, cor: '#ef4444' },
  { type: 'ia', label: 'IA', icon: Bot, cor: '#06b6d4' },
  { type: 'comprovante', label: 'Comprovante', icon: Receipt, cor: '#14b8a6' },
  { type: 'tag', label: 'Tag', icon: Tag, cor: '#f97316' },
  { type: 'transferencia', label: 'Transferir', icon: ArrowRightLeft, cor: '#a855f7' },
];

// Componente de nó personalizado
function BlocoNode({ data }) {
  const tipoInfo = TIPOS_BLOCOS.find((t) => t.type === data.blocoType) || TIPOS_BLOCOS[0];
  const Icone = tipoInfo.icon;
  const isCondicao = data.blocoType === 'condicao';
  const isBotoes = data.blocoType === 'botoes';

  return (
    <div
      className="bg-white rounded-lg border-2 shadow-sm min-w-[200px] cursor-pointer relative"
      style={{ borderColor: tipoInfo.cor }}
    >
      {/* Handle de entrada (topo) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: tipoInfo.cor,
          width: 12,
          height: 12,
          border: '2px solid white',
          top: -6,
        }}
      />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-md" style={{ backgroundColor: tipoInfo.cor + '15' }}>
        <Icone size={14} style={{ color: tipoInfo.cor }} />
        <span className="text-xs font-semibold" style={{ color: tipoInfo.cor }}>{tipoInfo.label}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-600 line-clamp-2">
          {data.preview || 'Clique para configurar'}
        </p>
      </div>

      {/* Handle de saída (base) */}
      {isCondicao ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="sim"
            style={{
              background: '#22c55e',
              width: 12,
              height: 12,
              border: '2px solid white',
              bottom: -6,
              left: '30%',
            }}
          />
          <div className="absolute text-[9px] font-bold text-green-600" style={{ bottom: -18, left: '26%' }}>Sim</div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="nao"
            style={{
              background: '#ef4444',
              width: 12,
              height: 12,
              border: '2px solid white',
              bottom: -6,
              left: '70%',
            }}
          />
          <div className="absolute text-[9px] font-bold text-red-600" style={{ bottom: -18, left: '66%' }}>Não</div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: tipoInfo.cor,
            width: 12,
            height: 12,
            border: '2px solid white',
            bottom: -6,
          }}
        />
      )}
    </div>
  );
}

const nodeTypes = { blocoNode: BlocoNode };

export default function FunilEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funil, setFunil] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [blocoSelecionado, setBlocoSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Carregar funil
  useEffect(() => {
    async function carregar() {
      try {
        const res = await api.get(`/funis/${id}`);
        setFunil(res.data);

        // Converter blocos para nodes do React Flow
        const blocos = res.data.blocos || [];
        const flowNodes = blocos.map((bloco) => ({
          id: bloco.id,
          type: 'blocoNode',
          position: bloco.position || { x: 250, y: 50 },
          data: {
            ...bloco.data,
            blocoType: bloco.type,
            preview: getPreview(bloco),
          },
        }));

        // Converter conexões para edges
        const conexoes = res.data.conexoes || [];
        const flowEdges = conexoes.map((con, i) => ({
          id: `edge-${i}`,
          source: con.source,
          target: con.target,
          sourceHandle: con.sourceHandle || null,
          animated: true,
          style: { stroke: '#94a3b8' },
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (err) {
        console.error('Erro ao carregar funil:', err);
      }
    }
    carregar();
  }, [id]);

  function getPreview(bloco) {
    switch (bloco.type) {
      case 'texto': return bloco.data?.mensagem?.substring(0, 50) || 'Mensagem de texto';
      case 'imagem': return 'Enviar imagem';
      case 'audio': return 'Enviar áudio';
      case 'video': return 'Enviar vídeo';
      case 'botoes': return `${bloco.data?.opcoes?.length || 0} opções`;
      case 'delay': return `Aguardar ${bloco.data?.tempo || 0} ${bloco.data?.unidade || 'minutos'}`;
      case 'condicao': return `Se contém: ${bloco.data?.valorEsperado || '...'}`;
      case 'ia': return bloco.data?.mensagemBase?.substring(0, 50) || 'Mensagem com IA';
      case 'comprovante': return 'Aguardar comprovante';
      case 'tag': return `Marcar tag`;
      case 'transferencia': return 'Transferir para humano';
      default: return bloco.type;
    }
  }

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds)),
    [setEdges]
  );

  // Adicionar novo bloco
  function adicionarBloco(tipo) {
    const novoId = `bloco-${Date.now()}`;
    const novoNode = {
      id: novoId,
      type: 'blocoNode',
      position: { x: 250, y: (nodes.length + 1) * 150 },
      data: {
        blocoType: tipo,
        preview: TIPOS_BLOCOS.find((t) => t.type === tipo)?.label,
      },
    };
    setNodes((nds) => [...nds, novoNode]);
  }

  // Salvar funil
  async function salvar() {
    setSalvando(true);
    try {
      // Converter nodes de volta para formato de blocos
      const blocos = nodes.map((node) => ({
        id: node.id,
        type: node.data.blocoType,
        position: node.position,
        data: { ...node.data, blocoType: undefined, preview: undefined },
      }));

      // Converter edges de volta para conexões
      const conexoes = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
      }));

      await api.put(`/funis/${id}`, {
        nome: funil.nome,
        descricao: funil.descricao,
        blocos,
        conexoes,
      });

      alert('Funil salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar funil');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  // Selecionar nó para editar
  function onNodeClick(_, node) {
    setBlocoSelecionado(node);
  }

  // Atualizar dados do bloco selecionado
  function atualizarBloco(campo, valor) {
    if (!blocoSelecionado) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === blocoSelecionado.id) {
          const novoData = { ...n.data, [campo]: valor };
          return { ...n, data: novoData };
        }
        return n;
      })
    );

    setBlocoSelecionado((prev) => ({
      ...prev,
      data: { ...prev.data, [campo]: valor },
    }));
  }

  if (!funil) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex">
      {/* Paleta de blocos (esquerda) */}
      <div className="w-48 bg-white border-r border-gray-200 p-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate('/funis')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={16} />
          </button>
          <h3 className="text-sm font-semibold text-gray-700">Blocos</h3>
        </div>
        <div className="space-y-1">
          {TIPOS_BLOCOS.map((tipo) => (
            <button
              key={tipo.type}
              onClick={() => adicionarBloco(tipo.type)}
              className="w-full flex items-center gap-2 px-2 py-2 text-xs rounded-lg hover:bg-gray-100 text-gray-700 text-left"
            >
              <tipo.icon size={14} style={{ color: tipo.cor }} />
              {tipo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Controls />
          <Background color="#e2e8f0" gap={20} />
          <Panel position="top-right">
            <div className="flex gap-2">
              <span className="bg-white px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border shadow-sm">
                {funil.nome}
              </span>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-1 bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 shadow-sm"
              >
                <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Painel de configuração do bloco (direita) */}
      {blocoSelecionado && (
        <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Configurar Bloco</h3>
            <button onClick={() => setBlocoSelecionado(null)} className="text-gray-400 hover:text-gray-600 text-xs">
              Fechar
            </button>
          </div>

          <div className="space-y-3">
            {/* Campos dinâmicos por tipo de bloco */}
            {blocoSelecionado.data.blocoType === 'texto' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
                <textarea
                  value={blocoSelecionado.data.mensagem || ''}
                  onChange={(e) => atualizarBloco('mensagem', e.target.value)}
                  className="w-full rounded border-gray-300 text-xs"
                  rows={4}
                  placeholder="Use {nome} para o nome do lead"
                />
              </div>
            )}

            {blocoSelecionado.data.blocoType === 'ia' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem Base</label>
                  <textarea
                    value={blocoSelecionado.data.mensagemBase || ''}
                    onChange={(e) => atualizarBloco('mensagemBase', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tom</label>
                  <select
                    value={blocoSelecionado.data.tom || 'informal'}
                    onChange={(e) => atualizarBloco('tom', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  >
                    <option value="formal">Formal</option>
                    <option value="informal">Informal</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="empatico">Empático</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contexto</label>
                  <textarea
                    value={blocoSelecionado.data.contexto || ''}
                    onChange={(e) => atualizarBloco('contexto', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    rows={2}
                    placeholder="Info sobre o produto/serviço"
                  />
                </div>
              </>
            )}

            {blocoSelecionado.data.blocoType === 'delay' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tempo</label>
                  <input
                    type="number"
                    value={blocoSelecionado.data.tempo || 5}
                    onChange={(e) => atualizarBloco('tempo', parseInt(e.target.value))}
                    className="w-full rounded border-gray-300 text-xs"
                    min={1}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                  <select
                    value={blocoSelecionado.data.unidade || 'minutos'}
                    onChange={(e) => atualizarBloco('unidade', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  >
                    <option value="segundos">Segundos</option>
                    <option value="minutos">Minutos</option>
                    <option value="horas">Horas</option>
                  </select>
                </div>
              </div>
            )}

            {blocoSelecionado.data.blocoType === 'imagem' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL da Imagem</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.url || ''}
                    onChange={(e) => atualizarBloco('url', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Legenda</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.legenda || ''}
                    onChange={(e) => atualizarBloco('legenda', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  />
                </div>
              </>
            )}

            {blocoSelecionado.data.blocoType === 'condicao' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de condição</label>
                  <select
                    value={blocoSelecionado.data.condicao || 'contem'}
                    onChange={(e) => atualizarBloco('condicao', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  >
                    <option value="contem">Contém</option>
                    <option value="igual">Igual a</option>
                    <option value="qualquer">Qualquer resposta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor esperado</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.valorEsperado || ''}
                    onChange={(e) => atualizarBloco('valorEsperado', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  />
                </div>
              </>
            )}

            {blocoSelecionado.data.blocoType === 'transferencia' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
                <textarea
                  value={blocoSelecionado.data.mensagem || ''}
                  onChange={(e) => atualizarBloco('mensagem', e.target.value)}
                  className="w-full rounded border-gray-300 text-xs"
                  rows={3}
                  placeholder="Mensagem antes de transferir"
                />
              </div>
            )}

            {blocoSelecionado.data.blocoType === 'comprovante' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
                <textarea
                  value={blocoSelecionado.data.mensagem || ''}
                  onChange={(e) => atualizarBloco('mensagem', e.target.value)}
                  className="w-full rounded border-gray-300 text-xs"
                  rows={3}
                  placeholder="Envie o comprovante de pagamento..."
                />
              </div>
            )}

            {/* Botão de deletar bloco */}
            <button
              onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== blocoSelecionado.id));
                setEdges((eds) => eds.filter((e) => e.source !== blocoSelecionado.id && e.target !== blocoSelecionado.id));
                setBlocoSelecionado(null);
              }}
              className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 mt-4"
            >
              Remover Bloco
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
