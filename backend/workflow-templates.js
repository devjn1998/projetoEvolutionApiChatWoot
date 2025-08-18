// Centraliza templates de workflows de agentes

function buildStandardAgentTemplate(workflowName, chatwootCredId, geminiCredId, googleSheetsCredId, ownerUserId) {
  return {
    name: workflowName,
    nodes: [
      {
        parameters: { httpMethod: 'POST', path: 'webhook-placeholder', options: {} },
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [-1220, -100],
        id: 'a1a40a36-1749-4a0c-b855-3486757a9ec6',
        name: 'Webhook',
      },
      {
        parameters: {
          keepOnlySet: true,
          values: {
            string: [
              { name: 'instanceName', value: "={{ $json.body.account.name }}" },
              { name: 'accountId', value: "={{ $json.body.account.id }}" },
              { name: 'conversationId', value: "={{ $json.body.conversation.id }}" },
              { name: 'content', value: "={{ $json.body.content }}" },
            ],
            json: [],
            number: [],
            boolean: [],
          },
          options: {},
        },
        id: '81b57eb8-09d9-44ac-9e85-c3fd968af654',
        name: 'Info',
        type: 'n8n-nodes-base.set',
        typeVersion: 2,
        position: [-1080, -100],
      },
      {
        parameters: {
          values: {
            string: [
              { name: 'telefone', value: "={{ ($json.body?.conversation?.messages?.[0]?.sender?.phone_number || $json.body?.sender?.phone_number || '').toString().replace(/@.*/,'').replace(/\\D/g,'').replace(/^0+/,'').replace(/^(?!55)/,'55') }}" },
              { name: 'id_conversa', value: "={{ $json.body.conversation.id }}" },
            ],
          },
          options: {},
        },
        id: '69123467-ba26-45c3-83ca-27f2981fdf8c',
        name: 'Normalizar Telefone',
        type: 'n8n-nodes-base.set',
        typeVersion: 2,
        position: [-920, -100],
      },
      {
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
            conditions: [
              {
                id: 'ae719122-8ef2-435a-8c9f-facf09e6cf21',
                leftValue: "={{ $('Webhook').item.json.body.message_type }}",
                rightValue: 'incoming',
                operator: { type: 'string', operation: 'equals', name: 'filter.operator.equals' },
              },
            ],
            combinator: 'and',
          },
          options: {},
        },
        id: '1d5ba960-d894-451d-8732-230cea892720',
        name: 'Filter',
        type: 'n8n-nodes-base.filter',
        typeVersion: 2.2,
        position: [-760, -100],
      },
      {
        parameters: {
          promptType: 'define',
          text: "={{ $('Info').item.json.content }}",
          options: {
            systemMessage:
              "**PERSONALIDADE:**\\nprestativa\\n\\n**PAPEL:**\\nassistente virtual\\n\\n**INSTRUÇÕES DE CONTEXTO (não exibir automaticamente):**\\nHOJE É: {{ $now.format('FFFF') }}\\nTELEFONE DO CONTATO: {{ $('Info').item.json.telefone }}\\nID DA CONVERSA: {{ $('Info').item.json.id_conversa }}\\n\\nUse essas informações apenas quando solicitado ou relevante. Não exiba por padrão.",
          },
        },
        id: '73d2d849-1cb5-437e-ad62-0859522c60b4',
        name: 'AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.9,
        position: [-580, -100],
      },
      {
        parameters: { modelName: 'models/gemini-2.5-pro', options: {} },
        id: '14f374a4-2c5c-4d69-af9e-5af06f54086d',
        name: 'Google Gemini Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
        typeVersion: 1,
        position: [-760, 220],
        credentials: { googleGenerativeAiApi: { id: geminiCredId, name: `Gemini Credential for ${workflowName}` } },
      },
      {
        parameters: {
          sessionIdType: 'customKey',
          sessionKey:
            "={{ $('Info').item.json.telefone || $('Info').item.json.id_conversa || $json.body?.conversation?.id || ('conv-' + $json.body?.account?.id + '-' + $json.body?.conversation?.id) }}",
          contextWindowLength: 50,
        },
        id: '8d3299a1-8c8d-41e0-8f4e-c9c598aaa15e',
        name: 'Simple Memory',
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        typeVersion: 1.3,
        position: [-560, 240],
      },
      {
        parameters: {
          resource: 'Messages',
          operation: 'Create A New Message In A Conversation',
          account_id: "={{ $('Info').item.json.accountId }}",
          conversation_id: "={{ $('Info').item.json.conversationId }}",
          content: '={{ $json.output }}',
          private: false,
          content_type: '=text',
          template_params: '{}',
          requestOptions: {},
        },
        id: '3d90fc08-7591-40c4-ba75-1843821083e2',
        name: 'Create New Message',
        type: '@devlikeapro/n8n-nodes-chatwoot.chatWoot',
        typeVersion: 1,
        position: [-60, -200],
        credentials: { chatwootApi: { id: chatwootCredId, name: `Chatwoot Credential for ${workflowName}` } },
      },
      {
        parameters: {
          resource: 'messages-api',
          operation: 'send-text',
          instanceName: "={{ $('Info').item.json.instanceName }}",
          remoteJid: "={{ $('Webhook').item.json.body.conversation.messages[0].sender.phone_number }}",
          messageText: '={{ $json.output }}',
          options_message: {},
        },
        id: '24692dbf-95e3-49cc-80bf-e11908a0762f',
        name: 'Enviar texto',
        type: 'n8n-nodes-evolution-api.evolutionApi',
        typeVersion: 1,
        position: [-60, 40],
      },
      {
        parameters: {
          documentId: { __rl: true, value: '1Zk0Q1ufeouzs6YGyK217NG_uJjM7wsvz6K-slY4_D38', mode: 'list' },
          sheetName: { __rl: true, value: 1438895352, mode: 'list' },
          options: {},
        },
        id: 'c9c4fd68-bb51-4c5d-946a-cf88c83c9d4c',
        name: 'Buscar Certificado',
        type: 'n8n-nodes-base.googleSheetsTool',
        typeVersion: 4.6,
        position: [-300, 260],
        credentials: { googleSheetsOAuth2Api: { id: googleSheetsCredId, name: `Google Sheets Credential for ${workflowName}` } },
      },
      {
        parameters: {
          operation: 'append',
          documentId: { __rl: true, value: '1Zk0Q1ufeouzs6YGyK217NG_uJjM7wsvz6K-slY4_D38', mode: 'list' },
          sheetName: { __rl: true, value: 1438895352, mode: 'list' },
          columns: {
            mappingMode: 'defineBelow',
            value: {
              'Tipo': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Tipo', '', 'string') }}",
              'Orgão emissor': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Org_o_emissor', '', 'string') }}",
              'Numeração': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Numera__o', '', 'string') }}",
              'Data de vencimento': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Data_de_vencimento', '', 'string') }}",
              'Data alerta': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Data_alerta', '', 'string') }}",
              'Situação': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Situa__o', '', 'string') }}",
            },
          },
          options: {},
        },
        id: '1af24ec2-5a5e-4b76-8127-ee2a2f33319a',
        name: 'Inserir dados',
        type: 'n8n-nodes-base.googleSheetsTool',
        typeVersion: 4.6,
        position: [-60, 320],
        credentials: { googleSheetsOAuth2Api: { id: googleSheetsCredId, name: `Google Sheets Credential for ${workflowName}` } },
      },
    ],
    connections: {
      Webhook: { main: [[{ node: 'Info', type: 'main', index: 0 }]] },
      Info: { main: [[{ node: 'Normalizar Telefone', type: 'main', index: 0 }]] },
      'Normalizar Telefone': { main: [[{ node: 'Filter', type: 'main', index: 0 }]] },
      Filter: { main: [[{ node: 'AI Agent', type: 'main', index: 0 }]] },
      'Google Gemini Chat Model': { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] },
      'Simple Memory': { ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]] },
      'Buscar Certificado': { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] },
      'Inserir dados': { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] },
      'AI Agent': { main: [[{ node: 'Create New Message', type: 'main', index: 0 }, { node: 'Enviar texto', type: 'main', index: 0 }]] },
    },
    settings: {},
  };
}

function getWorkflowTemplateByType(templateType, workflowName, chatwootCredId, geminiCredId, googleSheetsCredId, ownerUserId) {
  const type = (templateType || 'standard').toLowerCase();
  switch (type) {
    case 'standard':
    default:
      return buildStandardAgentTemplate(workflowName, chatwootCredId, geminiCredId, googleSheetsCredId, ownerUserId);
  }
}

module.exports = { getWorkflowTemplateByType };


