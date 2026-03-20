import { useState, useEffect, useCallback, useRef } from 'react';
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
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save, ArrowLeft, MessageSquare, Image, Mic, Video,
  Clock, GitBranch, Bot, Tag, MessageCircle, Play, Upload, X, FileText,
} from 'lucide-react';
import api from '../api';

// Tipos de blocos disponíveis
const TIPOS_BLOCOS = [
  { type: 'texto', label: 'Texto', icon: MessageSquare, cor: '#3b82f6' },
  { type: 'imagem', label: 'Imagem', icon: Image, cor: '#8b5cf6' },
  { type: 'audio', label: 'Audio', icon: Mic, cor: '#ec4899' },
  { type: 'video', label: 'Video', icon: Video, cor: '#f59e0b' },
  { type: 'documento', label: 'PDF/Doc', icon: FileText, cor: '#dc2626' },
  { type: 'delay', label: 'Delay', icon: Clock, cor: '#6b7280' },
  { type: 'condicao', label: 'Condicao', icon: GitBranch, cor: '#ef4444' },
  { type: 'ia', label: 'IA', icon: Bot, cor: '#06b6d4' },
  { type: 'esperar_resposta', label: 'Esperar Resposta', icon: MessageCircle, cor: '#0ea5e9' },
  { type: 'tag', label: 'Tag', icon: Tag, cor: '#f97316' },
];

// Componente de no personalizado
function BlocoNode({ data }) {
  const isInicio = data.blocoType === 'inicio';

  if (isInicio) {
    return (
      <div className="bg-green-500 rounded-full px-6 py-3 shadow-md text-center min-w-[120px]">
        <div className="flex items-center justify-center gap-2">
          <Play size={16} className="text-white" />
          <span className="text-sm font-bold text-white">INICIO</span>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: '#22c55e',
            width: 14,
            height: 14,
            border: '3px solid white',
            bottom: -7,
          }}
        />
      </div>
    );
  }

  const tipoInfo = TIPOS_BLOCOS.find((t) => t.type === data.blocoType) || TIPOS_BLOCOS[0];
  const Icone = tipoInfo.icon;
  const isCondicao = data.blocoType === 'condicao';
  const isEsperarResposta = data.blocoType === 'esperar_resposta';

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

      {/* Handle de saida (base) */}
      {isCondicao || isEsperarResposta ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id={isCondicao ? 'sim' : 'respondeu'}
            style={{
              background: '#22c55e',
              width: 14,
              height: 14,
              border: '2px solid white',
              bottom: -7,
              left: '30%',
              zIndex: 20,
              cursor: 'crosshair',
            }}
          />
          <div className="absolute text-[9px] font-bold text-green-600" style={{ bottom: -20, left: isCondicao ? '26%' : '16%', pointerEvents: 'none', zIndex: 1 }}>
            {isCondicao ? 'Sim' : 'Respondeu'}
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id={isCondicao ? 'nao' : 'timeout'}
            style={{
              background: '#ef4444',
              width: 14,
              height: 14,
              border: '2px solid white',
              bottom: -7,
              left: '70%',
              zIndex: 20,
              cursor: 'crosshair',
            }}
          />
          <div className="absolute text-[9px] font-bold text-red-600" style={{ bottom: -20, left: isCondicao ? '66%' : '52%', pointerEvents: 'none', zIndex: 1 }}>
            {isCondicao ? 'Nao' : 'Nao respondeu'}
          </div>
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

// Edge com botão de deletar
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <button
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 10,
          }}
          onClick={() => setEdges((eds) => eds.filter((e) => e.id !== id))}
          className="bg-white border border-red-400 text-red-500 rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-500 hover:text-white shadow-sm"
          title="Remover conexão"
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { blocoNode: BlocoNode };
const edgeTypes = { deletable: DeletableEdge };

export default function FunilEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funil, setFunil] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [blocoSelecionado, setBlocoSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Carregar funil
  useEffect(() => {
    async function carregar() {
      try {
        const res = await api.get(`/funis/${id}`);
        setFunil(res.data);

        const blocos = res.data.blocos || [];
        let flowNodes = blocos.map((bloco) => ({
          id: bloco.id,
          type: 'blocoNode',
          position: bloco.position || { x: 250, y: 50 },
          data: {
            ...bloco.data,
            blocoType: bloco.type,
            preview: getPreview(bloco),
          },
        }));

        // Se nao tem bloco de inicio, adicionar
        const temInicio = flowNodes.some((n) => n.data.blocoType === 'inicio');
        if (!temInicio) {
          flowNodes = [
            {
              id: 'inicio',
              type: 'blocoNode',
              position: { x: 250, y: 20 },
              data: { blocoType: 'inicio', preview: 'Inicio do funil' },
            },
            ...flowNodes,
          ];
        }

        const conexoes = res.data.conexoes || [];
        const flowEdges = conexoes.map((con, i) => ({
          id: `edge-${i}`,
          source: con.source,
          target: con.target,
          sourceHandle: con.sourceHandle || null,
          type: 'deletable',
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
      case 'inicio': return 'Inicio do funil';
      case 'texto': return bloco.data?.mensagem?.substring(0, 50) || 'Mensagem de texto';
      case 'imagem': return bloco.data?.nomeArquivo || bloco.data?.url || 'Enviar imagem';
      case 'audio': return bloco.data?.nomeArquivo || bloco.data?.url || 'Enviar audio';
      case 'video': return bloco.data?.nomeArquivo || bloco.data?.url || 'Enviar video';
      case 'documento': return bloco.data?.nomeArquivo || bloco.data?.nomeExibido || bloco.data?.url || 'Enviar PDF/Doc';
      case 'delay': return `Aguardar ${bloco.data?.tempo || 0} ${bloco.data?.unidade || 'minutos'}`;
      case 'condicao': return `Se contem: ${bloco.data?.valorEsperado || '...'}`;
      case 'ia': return bloco.data?.mensagemBase?.substring(0, 50) || 'Mensagem com IA';
      case 'esperar_resposta': return `Esperar ${bloco.data?.tempoTimeout || 30} ${bloco.data?.unidadeTimeout || 'minutos'}`;
      case 'tag': return 'Marcar tag';
      default: return bloco.type;
    }
  }

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'deletable', animated: true, style: { stroke: '#94a3b8' } }, eds)),
    [setEdges]
  );

  function getUltimoBloco(currentNodes) {
    if (currentNodes.length === 0) return null;
    return currentNodes.reduce((ultimo, n) =>
      n.position.y > ultimo.position.y ? n : ultimo
    , currentNodes[0]);
  }

  function adicionarBloco(tipo) {
    const novoId = `bloco-${Date.now()}`;

    setNodes((nds) => {
      const ultimoBloco = getUltimoBloco(nds);
      const yPos = ultimoBloco ? ultimoBloco.position.y + 140 : 150;
      const xPos = ultimoBloco ? ultimoBloco.position.x : 250;

      const novoNode = {
        id: novoId,
        type: 'blocoNode',
        position: { x: xPos, y: yPos },
        data: {
          blocoType: tipo,
          preview: TIPOS_BLOCOS.find((t) => t.type === tipo)?.label,
        },
      };

      // Auto-conectar ao último bloco (exceto condicao/esperar_resposta que têm múltiplas saídas)
      if (ultimoBloco && ultimoBloco.data.blocoType !== 'condicao' && ultimoBloco.data.blocoType !== 'esperar_resposta') {
        setEdges((eds) => [...eds, {
          id: `edge-${Date.now()}`,
          source: ultimoBloco.id,
          target: novoId,
          type: 'deletable',
          animated: true,
          style: { stroke: '#94a3b8' },
        }]);
      }

      // Auto-selecionar o novo bloco no painel direito
      setTimeout(() => setBlocoSelecionado(novoNode), 50);

      return [...nds, novoNode];
    });
  }

  // Upload de arquivo
  async function uploadArquivo(file, campo) {
    if (!file || !blocoSelecionado) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      atualizarBloco('url', res.data.url);
      atualizarBloco('nomeArquivo', file.name);
    } catch (err) {
      alert('Erro ao enviar arquivo');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const blocos = nodes.map((node) => ({
        id: node.id,
        type: node.data.blocoType,
        position: node.position,
        data: { ...node.data, blocoType: undefined, preview: undefined },
      }));

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

  function onNodeClick(_, node) {
    // Nao selecionar bloco de inicio
    if (node.data.blocoType === 'inicio') return;
    setBlocoSelecionado(node);
  }

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
          edgeTypes={edgeTypes}
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

      {/* Painel de configuracao do bloco (direita) */}
      {blocoSelecionado && (
        <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Configurar Bloco</h3>
            <button onClick={() => setBlocoSelecionado(null)} className="text-gray-400 hover:text-gray-600 text-xs">
              Fechar
            </button>
          </div>

          <div className="space-y-3">
            {/* Texto */}
            {blocoSelecionado.data.blocoType === 'texto' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
                <textarea
                  value={blocoSelecionado.data.mensagem || ''}
                  onChange={(e) => atualizarBloco('mensagem', e.target.value)}
                  className="w-full rounded border-gray-300 text-xs resize-y min-h-[80px]"
                  rows={4}
                  placeholder="Use {nome} para o nome do lead"
                />
              </div>
            )}

            {/* Imagem */}
            {blocoSelecionado.data.blocoType === 'imagem' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enviar imagem do PC</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
                  >
                    {uploading ? (
                      <div className="text-xs text-gray-500">Enviando...</div>
                    ) : blocoSelecionado.data.nomeArquivo ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600 truncate">{blocoSelecionado.data.nomeArquivo}</span>
                        <button onClick={(e) => { e.stopPropagation(); atualizarBloco('url', ''); atualizarBloco('nomeArquivo', ''); }} className="text-red-400 hover:text-red-600">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={20} className="text-gray-400" />
                        <span className="text-xs text-gray-500">Clique para enviar imagem</span>
                        <span className="text-[10px] text-gray-400">JPG, PNG, WebP</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadArquivo(e.target.files[0])}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ou cole a URL da imagem</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.url || ''}
                    onChange={(e) => atualizarBloco('url', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    placeholder="https://..."
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

            {/* Audio */}
            {blocoSelecionado.data.blocoType === 'audio' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enviar audio do PC</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-pink-400 hover:bg-pink-50 transition-colors"
                  >
                    {uploading ? (
                      <div className="text-xs text-gray-500">Enviando...</div>
                    ) : blocoSelecionado.data.nomeArquivo ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600 truncate">{blocoSelecionado.data.nomeArquivo}</span>
                        <button onClick={(e) => { e.stopPropagation(); atualizarBloco('url', ''); atualizarBloco('nomeArquivo', ''); }} className="text-red-400 hover:text-red-600">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={20} className="text-gray-400" />
                        <span className="text-xs text-gray-500">Clique para enviar audio</span>
                        <span className="text-[10px] text-gray-400">MP3, OGG, WAV, M4A</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => uploadArquivo(e.target.files[0])}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ou cole a URL do audio</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.url || ''}
                    onChange={(e) => atualizarBloco('url', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    placeholder="https://..."
                  />
                </div>
              </>
            )}

            {/* Video */}
            {blocoSelecionado.data.blocoType === 'video' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enviar video do PC</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-yellow-400 hover:bg-yellow-50 transition-colors"
                  >
                    {uploading ? (
                      <div className="text-xs text-gray-500">Enviando...</div>
                    ) : blocoSelecionado.data.nomeArquivo ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600 truncate">{blocoSelecionado.data.nomeArquivo}</span>
                        <button onClick={(e) => { e.stopPropagation(); atualizarBloco('url', ''); atualizarBloco('nomeArquivo', ''); }} className="text-red-400 hover:text-red-600">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={20} className="text-gray-400" />
                        <span className="text-xs text-gray-500">Clique para enviar video</span>
                        <span className="text-[10px] text-gray-400">MP4, AVI, MOV</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => uploadArquivo(e.target.files[0])}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ou cole a URL do video</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.url || ''}
                    onChange={(e) => atualizarBloco('url', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    placeholder="https://..."
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

            {/* Documento/PDF */}
            {blocoSelecionado.data.blocoType === 'documento' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enviar PDF do PC</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors"
                  >
                    {uploading ? (
                      <div className="text-xs text-gray-500">Enviando...</div>
                    ) : blocoSelecionado.data.nomeArquivo ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600 truncate">{blocoSelecionado.data.nomeArquivo}</span>
                        <button onClick={(e) => { e.stopPropagation(); atualizarBloco('url', ''); atualizarBloco('nomeArquivo', ''); }} className="text-red-400 hover:text-red-600">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <FileText size={20} className="text-gray-400" />
                        <span className="text-xs text-gray-500">Clique para enviar PDF</span>
                        <span className="text-[10px] text-gray-400">PDF, DOC, DOCX</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => uploadArquivo(e.target.files[0])}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ou cole a URL do documento</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.url || ''}
                    onChange={(e) => atualizarBloco('url', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome exibido no WhatsApp</label>
                  <input
                    type="text"
                    value={blocoSelecionado.data.nomeExibido || ''}
                    onChange={(e) => atualizarBloco('nomeExibido', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                    placeholder="Ex: Contrato.pdf"
                  />
                </div>
              </>
            )}

            {/* IA */}
            {blocoSelecionado.data.blocoType === 'ia' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem Base</label>
                  <textarea
                    value={blocoSelecionado.data.mensagemBase || ''}
                    onChange={(e) => atualizarBloco('mensagemBase', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs resize-y min-h-[60px]"
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
                    <option value="empatico">Empatico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contexto</label>
                  <textarea
                    value={blocoSelecionado.data.contexto || ''}
                    onChange={(e) => atualizarBloco('contexto', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs resize-y min-h-[50px]"
                    rows={2}
                    placeholder="Info sobre o produto/servico"
                  />
                </div>
              </>
            )}

            {/* Delay */}
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

            {/* Condicao */}
            {blocoSelecionado.data.blocoType === 'condicao' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de condicao</label>
                  <select
                    value={blocoSelecionado.data.condicao || 'contem'}
                    onChange={(e) => atualizarBloco('condicao', e.target.value)}
                    className="w-full rounded border-gray-300 text-xs"
                  >
                    <option value="contem">Contem</option>
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

            {/* Esperar Resposta */}
            {blocoSelecionado.data.blocoType === 'esperar_resposta' && (
              <>
                <div className="bg-blue-50 rounded-lg p-2 mb-1">
                  <p className="text-xs text-blue-700">Aguarda a resposta do lead. Se responder, segue pelo caminho "Respondeu". Se nao responder no tempo definido, segue pelo caminho "Nao respondeu".</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tempo limite</label>
                    <input
                      type="number"
                      value={blocoSelecionado.data.tempoTimeout || 30}
                      onChange={(e) => atualizarBloco('tempoTimeout', parseInt(e.target.value))}
                      className="w-full rounded border-gray-300 text-xs"
                      min={1}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                    <select
                      value={blocoSelecionado.data.unidadeTimeout || 'minutos'}
                      onChange={(e) => atualizarBloco('unidadeTimeout', e.target.value)}
                      className="w-full rounded border-gray-300 text-xs"
                    >
                      <option value="segundos">Segundos</option>
                      <option value="minutos">Minutos</option>
                      <option value="horas">Horas</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Tag */}
            {blocoSelecionado.data.blocoType === 'tag' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome da tag</label>
                <input
                  type="text"
                  value={blocoSelecionado.data.tag || ''}
                  onChange={(e) => atualizarBloco('tag', e.target.value)}
                  className="w-full rounded border-gray-300 text-xs"
                  placeholder="Ex: VIP, Interessado"
                />
              </div>
            )}

            {/* Botao de deletar bloco */}
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
