#!/usr/bin/env node

/**
 * DeepSeek Function Call 调试工具
 * 用于测试和验证Function Call参数格式
 */

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// 最简化的Function Call定义
const testFunctions = [
  {
    type: "function",
    function: {
      name: "test_function",
      description: "A simple test function",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Test message"
          }
        },
        required: ["message"]
      }
    }
  }
];

async function testDeepSeekFunctionCall() {
  console.log('🧪 Testing DeepSeek Function Call...');
  
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY not found in environment variables');
    return;
  }

  try {
    console.log('📤 Sending request to DeepSeek API...');
    
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant that can use functions when needed.' 
          },
          { 
            role: 'user', 
            content: 'Please call the test function with message "hello world"' 
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
        tools: testFunctions,
        tool_choice: 'auto'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ DeepSeek API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.choices[0]?.message?.tool_calls) {
      console.log('🎉 Function Call successful!');
      console.log('Function calls:', response.data.choices[0].message.tool_calls);
    } else {
      console.log('⚠️ No function calls in response');
      console.log('Response content:', response.data.choices[0]?.message?.content);
    }

  } catch (error) {
    console.error('❌ DeepSeek API Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 422) {
        console.error('\n🔍 422 Error Analysis:');
        console.error('This usually means the JSON schema or request format is invalid.');
        console.error('Check the function definitions and parameter schema.');
      }
    } else {
      console.error('Error:', error.message);
    }
  }
}

// 测试不带Function Call的基础请求
async function testBasicCall() {
  console.log('\n🧪 Testing basic DeepSeek call (without functions)...');
  
  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: 'Say hello' }
        ],
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Basic call successful');
    console.log('Response:', response.data.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('❌ Basic call failed:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 DeepSeek Function Call Debug Tool\n');
  
  // 首先测试基础调用
  await testBasicCall();
  
  // 然后测试Function Call
  await testDeepSeekFunctionCall();
  
  console.log('\n✨ Debug session completed');
}

main().catch(console.error);