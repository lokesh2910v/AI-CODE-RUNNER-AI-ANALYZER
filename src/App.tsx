import React, { useState, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-clike';
import 'prismjs/themes/prism.css';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Code, AlertCircle, CheckCircle, Loader2, BrainCircuit, Play, Zap, BarChart, Terminal } from 'lucide-react';
import axios from 'axios';

function App() {
  const [code, setCode] = useState('// Enter your code here');
  const [resultInput, setResultInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [language, setLanguage] = useState('javascript');
  const [analysisMode, setAnalysisMode] = useState('success');
  const [userInput, setUserInput] = useState('');
  const [metrics, setMetrics] = useState<{
    timeComplexity: string;
    spaceComplexity: string;
    linesOfCode: number;
  } | null>(null);

  const createGenAI = useCallback(() => {
    return new GoogleGenerativeAI('AIzaSyBjDQsK-ajkdnqoHYELW0hV3OzN1xBzQTQ');
  }, []);

  const getPistonLanguage = useCallback((lang: string) => {
    switch(lang) {
      case 'javascript': return 'nodejs';
      case 'python': return 'python3';
      case 'java': return 'java';
      case 'c': return 'c';
      case 'cpp': return 'cpp';
      default: return 'nodejs';
    }
  }, []);

  const getPistonVersion = useCallback((lang: string) => {
    switch(lang) {
      case 'javascript': return '18.15.0';
      case 'python': return '3.10.0';
      case 'java': return '15.0.2';
      case 'c': return '10.2.0';
      case 'cpp': return '10.2.0';
      default: return '18.15.0';
    }
  }, []);

  const getFileName = useCallback((lang: string) => {
    switch(lang) {
      case 'javascript': return 'code.js';
      case 'python': return 'code.py';
      case 'java': return 'Main.java';
      case 'c': return 'code.c';
      case 'cpp': return 'code.cpp';
      default: return 'code.js';
    }
  }, []);

  const calculateMetrics = useCallback(async () => {
    try {
      const genAI = createGenAI();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const prompt = `Analyze this ${language} code and provide ONLY the following metrics:
      1. Time complexity (Big O notation)
      2. Space complexity (Big O notation)
      
      CODE:
      \`\`\`${language}
      ${code}
      \`\`\`
      
      Format your response as a JSON object with the following structure:
      {
        "timeComplexity": "O(?)",
        "spaceComplexity": "O(?)"
      }
      
      Only return the JSON object, nothing else.`;
      
      const result = await model.generateContent(prompt);
      if (!result?.response) {
        throw new Error('No response from AI model');
      }
      
      const text = result.response.text();
      if (!text) {
        throw new Error('Empty response from AI model');
      }
      
      try {
        let jsonText = text;
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1];
        }
        
        const metricsData = JSON.parse(jsonText);
        if (!metricsData?.timeComplexity || !metricsData?.spaceComplexity) {
          throw new Error('Invalid metrics data format');
        }
        
        const codeLines = code.split('\n').filter(line => {
          const trimmedLine = line.trim();
          return trimmedLine && 
                 !trimmedLine.startsWith('//') && 
                 !trimmedLine.startsWith('#') && 
                 !trimmedLine.startsWith('/*') && 
                 !trimmedLine.startsWith('*');
        }).length;
        
        setMetrics({
          timeComplexity: metricsData.timeComplexity,
          spaceComplexity: metricsData.spaceComplexity,
          linesOfCode: codeLines
        });
      } catch (parseErr) {
        console.error('Error parsing metrics:', parseErr);
        setMetrics({
          timeComplexity: 'Unable to determine',
          spaceComplexity: 'Unable to determine',
          linesOfCode: code.split('\n').length
        });
      }
    } catch (err) {
      console.error('Error calculating metrics:', err);
      setMetrics({
        timeComplexity: 'Error calculating',
        spaceComplexity: 'Error calculating',
        linesOfCode: code.split('\n').length
      });
    }
  }, [code, language, createGenAI]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    setResultInput('');
    setAnalysisMode('success');
    setMetrics(null);
    
    try {
      const pistonLanguage = getPistonLanguage(language);
      const pistonVersion = getPistonVersion(language);
      const fileName = getFileName(language);
      
      const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
        language: pistonLanguage,
        version: pistonVersion,
        files: [
          {
            name: fileName,
            content: code
          }
        ],
        stdin: userInput,
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000
      });
      
      if (response.data.run.stderr) {
        setAnalysisMode('error');
        setResultInput(response.data.run.stderr);
      } else {
        setAnalysisMode('success');
        setResultInput(response.data.run.stdout);
      }
      
      await calculateMetrics();
    } catch (err) {
      console.error('Error running code:', err);
      setAnalysisMode('error');
      if (err instanceof Error) {
        setResultInput(`Error running code: ${err.message}`);
      } else {
        setResultInput('Error running code: An unknown error occurred');
      }
    } finally {
      setIsRunning(false);
    }
  }, [code, language, userInput, getPistonLanguage, getPistonVersion, getFileName, calculateMetrics]);

  const analyzeCode = useCallback(async () => {
    if (!code.trim()) {
      setAnalysisResult('Please enter some code to analyze.');
      return;
    }

    setIsLoading(true);
    setAnalysisResult('');
    
    try {
      const genAI = createGenAI();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const prompt = analysisMode === 'success' 
        ? `Analyze this ${language} code and its output:
        
CODE:
\`\`\`${language}
${code}
\`\`\`

INPUT:
\`\`\`
${userInput}
\`\`\`

OUTPUT:
\`\`\`
${resultInput}
\`\`\`

Please provide:
1. A clear explanation of what this code does
2. The optimal approach for this problem
3. An optimized version of this code 

Format your response in markdown.`
        : `Debug this ${language} code that produces the following error:
        
CODE:
\`\`\`${language}
${code}
\`\`\`

ERROR:
\`\`\`
${resultInput}
\`\`\`

Please provide:
1. An explanation of what's causing the error
2. A solution approach to fix the issue
3. The corrected code 

Format your response in markdown.`;
      
      const result = await model.generateContent(prompt);
      if (!result?.response) {
        throw new Error('No response from AI model');
      }
      
      const text = result.response.text();
      if (!text) {
        throw new Error('Empty response from AI model');
      }
      
      setAnalysisResult(text);
    } catch (err) {
      console.error('Error analyzing code:', err);
      let errorMessage = 'An error occurred while analyzing the code. ';
      
      if (err instanceof Error) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setAnalysisResult(`# Analysis Error\n\n${errorMessage}\n\nIf this persists, try:\n1. Simplifying your code\n2. Checking for syntax errors\n3. Running the code first to ensure it works`);
    } finally {
      setIsLoading(false);
    }
  }, [code, language, userInput, resultInput, analysisMode, createGenAI]);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  }, []);

  const handleModeChange = useCallback((mode: 'success' | 'error') => {
    setAnalysisMode(mode);
  }, []);

  const highlightCode = useCallback((code: string) => {
    try {
      return highlight(code, languages[language] || languages.clike, language);
    } catch (err) {
      console.error('Error highlighting code:', err);
      return code;
    }
  }, [language]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit size={28} />
            <h1 className="text-2xl font-bold">Code Analyzer</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Powered by Gemini AI</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Code size={20} />
                  Code Editor
                </h2>
                <div className="flex items-center gap-2">
                  <select 
                    value={language}
                    onChange={handleLanguageChange}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>
              </div>
              <div className="border rounded-md overflow-auto max-h-[400px]">
                <Editor
                  value={code}
                  onValueChange={setCode}
                  highlight={highlightCode}
                  padding={10}
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 14,
                    minHeight: '300px',
                  }}
                  className="w-full"
                />
              </div>
              <div className="mt-3">
                <button
                  onClick={runCode}
                  disabled={isRunning}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow transition flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      Run Code
                    </>
                  )}
                </button>
              </div>
            </div>

            {metrics && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <BarChart size={20} className="text-indigo-600" />
                  Code Metrics
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50 p-3 rounded-lg">
                    <div className="text-xs text-indigo-600 font-medium mb-1">Time Complexity</div>
                    <div className="text-lg font-bold">{metrics.timeComplexity}</div>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-lg">
                    <div className="text-xs text-indigo-600 font-medium mb-1">Space Complexity</div>
                    <div className="text-lg font-bold">{metrics.spaceComplexity}</div>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-lg">
                    <div className="text-xs text-indigo-600 font-medium mb-1">Lines of Code</div>
                    <div className="text-lg font-bold">{metrics.linesOfCode}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Terminal size={20} />
                  Program Input
                </h2>
              </div>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter program input here (if required)..."
                className="w-full border rounded-md p-2 h-24 font-mono text-sm overflow-auto"
              />
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {analysisMode === 'success' ? (
                    <CheckCircle size={20} className="text-green-500" />
                  ) : (
                    <AlertCircle size={20} className="text-red-500" />
                  )}
                  {analysisMode === 'success' ? 'Output' : 'Error'}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleModeChange('success')}
                    className={`px-3 py-1 rounded-md text-sm font-medium flex items-center gap-1 ${
                      analysisMode === 'success'
                        ? 'bg-green-100 text-green-700 ring-1 ring-green-400'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CheckCircle size={16} />
                    Output
                  </button>
                  <button
                    onClick={() => handleModeChange('error')}
                    className={`px-3 py-1 rounded-md text-sm font-medium flex items-center gap-1 ${
                      analysisMode === 'error'
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-400'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <AlertCircle size={16} />
                    Error
                  </button>
                </div>
              </div>
              <textarea
                value={resultInput}
                onChange={(e) => setResultInput(e.target.value)}
                placeholder={`Program ${analysisMode === 'success' ? 'output' : 'error'} will appear here...`}
                className="w-full border rounded-md p-2 h-32 font-mono text-sm overflow-auto"
                readOnly
              />
            </div>

            <button
              onClick={analyzeCode}
              disabled={isLoading || !code.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md shadow transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap size={20} />
                  Analyze Code
                </>
              )}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BrainCircuit size={20} className="text-indigo-600" />
              Analysis Result
            </h2>
            <div className="border rounded-md p-4 min-h-[500px] max-h-[1000px] prose max-w-none overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <span className="ml-2 text-gray-600">Analyzing your code...</span>
                </div>
              ) : analysisResult ? (
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(analysisResult) }} />
              ) : (
                <div className="text-gray-500 flex flex-col items-center justify-center h-full">
                  <BrainCircuit size={48} className="text-gray-300 mb-4" />
                  <p>Enter your code, run it, and then click "Analyze Code" to get AI-powered insights.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 bg-gray-100 border-t py-6">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>Code Analyzer App powered by Gemini AI API</p>
        </div>
      </footer>
    </div>
  );
}

function formatMarkdown(text: string) {
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  text = text.replace(/```([a-z]*)\n([\s\S]*?)\n```/gm, '<pre><code class="language-$1">$2</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/^\s*\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>');
  text = text.replace(/^\s*[\-\*]\s+(.*$)/gim, '<ul><li>$1</li></ul>');
  text = text.replace(/^(?!<[a-z])(.*$)/gim, '<p>$1</p>');
  text = text.replace(/<\/ol>\s*<ol>/g, '');
  text = text.replace(/<\/ul>\s*<ul>/g, '');
  return text;
}

export default App;