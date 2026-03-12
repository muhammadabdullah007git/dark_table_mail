import React, { useState, useEffect, useRef } from 'react';
import { loadSetting, saveSetting, GAS_URL_KEY, WHATSAPP_COUNTRY_CODE_KEY, CURRENT_PLATFORM_KEY, THEME_KEY, UI_FONT_KEY, UI_FONT_SIZE_KEY, SIDE_PANEL_WIDTH_KEY, SOURCE_MODE_KEY, MAIL_COUNT_MODE_KEY, VARIABLE_MAPPING_KEY, FIXED_MAIL_RANGE_KEY } from './lib/storage';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import './styles/theme.css';
import './styles/App.css';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface WhatsAppItem {
  id: number;
  cc: string;
  phone: string;
  text: string;
  sent: boolean;
}

type Platform = 'gmail' | 'whatsapp';

const App: React.FC = () => {
  // Persistence States
  const [theme, setTheme] = useState(loadSetting(THEME_KEY) || 'dark');
  const [uiFont, setUiFont] = useState(loadSetting(UI_FONT_KEY) || 'Inter');
  const [uiFontSize, setUiFontSize] = useState(parseInt(loadSetting(UI_FONT_SIZE_KEY) || '13'));
  const [currentPlatform, setCurrentPlatform] = useState<Platform>((loadSetting(CURRENT_PLATFORM_KEY) as Platform) || 'gmail');
  const [gasUrl, setGasUrl] = useState(loadSetting(GAS_URL_KEY) || '');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(loadSetting(WHATSAPP_COUNTRY_CODE_KEY) || '92');
  const [sidePanelWidth, setSidePanelWidth] = useState(parseInt(loadSetting(SIDE_PANEL_WIDTH_KEY) || '450'));
  const [isSourceMode, setIsSourceMode] = useState(loadSetting(SOURCE_MODE_KEY) === 'true');
  const [mailCountMode, setMailCountMode] = useState<'auto' | 'fixed' | 'manual'>((loadSetting(MAIL_COUNT_MODE_KEY) as any) || 'auto');

  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkActive, setBulkActive] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [helpTab, setHelpTab] = useState<Platform>('gmail');
  const [generatedWhatsAppItems, setGeneratedWhatsAppItems] = useState<WhatsAppItem[]>([]);
  const [showWhatsAppList, setShowWhatsAppList] = useState(false);
  
  // Compose States
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Bulk State
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkColumns, setBulkColumns] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [variableMapping, setBulkMapping] = useState<Record<string, string>>(() => {
    try { return JSON.parse(loadSetting(VARIABLE_MAPPING_KEY) || '{}'); } catch { return {}; }
  });
  const [fixedMailRange, setFixedMailRange] = useState<{ from: number; to: number }>(() => {
    try { return JSON.parse(loadSetting(FIXED_MAIL_RANGE_KEY) || '{"from":1,"to":1}'); } catch { return { from: 1, to: 1 }; }
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ show: boolean; url: string; range: Range | null }>({ show: false, url: '', range: null });
  
  const editorRef = useRef<HTMLDivElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const gasCode = `function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    MailApp.sendEmail({
      to: data.to.join(','),
      cc: data.cc ? data.cc.join(',') : '',
      bcc: data.bcc ? data.bcc.join(',') : '',
      subject: data.subject,
      htmlBody: data.body,
      attachments: data.attachments ? data.attachments.map(att => {
        return Utilities.newBlob(Utilities.base64Decode(att.data), att.type, att.name);
      }) : []
    });
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}`;

  const toggleIndex = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIndices.size === bulkData.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(bulkData.map((_, i) => i)));
    }
  };

  const addLog = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev]);
  };

  // Persist Preferences
  useEffect(() => {
    document.body.className = `theme-${theme}`;
    document.body.style.setProperty('--font-family', uiFont);
    document.body.style.setProperty('--base-font-size', `${uiFontSize}px`);
    saveSetting(THEME_KEY, theme);
    saveSetting(UI_FONT_KEY, uiFont);
    saveSetting(UI_FONT_SIZE_KEY, uiFontSize.toString());
  }, [theme, uiFont, uiFontSize]);

  useEffect(() => {
    saveSetting(GAS_URL_KEY, gasUrl);
  }, [gasUrl]);

  useEffect(() => {
    saveSetting(WHATSAPP_COUNTRY_CODE_KEY, whatsappCountryCode);
  }, [whatsappCountryCode]);

  useEffect(() => {
    saveSetting(CURRENT_PLATFORM_KEY, currentPlatform);
  }, [currentPlatform]);

  useEffect(() => {
    saveSetting(SIDE_PANEL_WIDTH_KEY, sidePanelWidth.toString());
  }, [sidePanelWidth]);

  useEffect(() => {
    saveSetting(SOURCE_MODE_KEY, isSourceMode.toString());
  }, [isSourceMode]);

  useEffect(() => {
    saveSetting(MAIL_COUNT_MODE_KEY, mailCountMode);
  }, [mailCountMode]);

  useEffect(() => {
    saveSetting(VARIABLE_MAPPING_KEY, JSON.stringify(variableMapping));
  }, [variableMapping]);

  useEffect(() => {
    saveSetting(FIXED_MAIL_RANGE_KEY, JSON.stringify(fixedMailRange));
  }, [fixedMailRange]);

  useEffect(() => {
    const combinedText = `${to} ${cc} ${bcc} ${subject} ${body}`;
    const matches = combinedText.match(/{[^{}]+}/g) || [];
    const uniqueVars = Array.from(new Set(matches.map(m => m.slice(1, -1))));
    setDetectedVariables(uniqueVars);
  }, [to, cc, bcc, subject, body]);

  useEffect(() => {
    if (!isSourceMode && editorRef.current && editorRef.current.innerHTML !== body) {
      editorRef.current.innerHTML = body;
    }
  }, [isSourceMode]);

  const showNotify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    setBulkFile(file);
    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setBulkData(results.data);
          if (results.data.length > 0) {
            setBulkColumns(Object.keys(results.data[0] as object));
            setFixedMailRange({ from: 1, to: results.data.length });
          }
          showNotify(`Loaded ${results.data.length} rows`, 'success');
        }
      });
    } else if (['xlsx', 'xls'].includes(extension || '')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setBulkData(data);
        if (data.length > 0) {
          setBulkColumns(Object.keys(data[0] as object));
          setFixedMailRange({ from: 1, to: data.length });
        }
        showNotify(`Loaded ${data.length} rows`, 'success');
      };
      reader.readAsBinaryString(file);
    } else {
      showNotify('Unsupported file format', 'error');
      setBulkFile(null);
    }
  };

  const replaceVariables = (text: string, row: any) => {
    let newText = text;
    Object.entries(variableMapping).forEach(([variable, column]) => {
      const value = row[column] || '';
      newText = newText.replace(new RegExp(`{${variable}}`, 'g'), value);
    });
    return newText;
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < window.innerWidth * 0.8) setSidePanelWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'off-white' : 'dark');

  const updateBody = () => {
    if (editorRef.current) setBody(editorRef.current.innerHTML);
  };

  const execCmd = (command: string, value: string = '') => {
    if (!isSourceMode) {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      updateBody();
    }
  };

  const modifyStyle = (styleName: string, value: string) => {
    if (!isSourceMode && editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const content = range.extractContents();
      const span = document.createElement('span');
      span.style[styleName as any] = value;
      span.style.display = 'inline-block';
      span.style.width = '100%';
      span.appendChild(content);
      range.insertNode(span);
      updateBody();
    }
  };

  const applyToBlocks = (styleName: string, value: string) => {
    if (!isSourceMode && editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (!selection) return;

      // This is a simplified block style application
      document.execCommand('formatBlock', false, 'div');
      const range = selection.getRangeAt(0);
      let container = range.commonAncestorContainer as HTMLElement;
      if (container.nodeType === 3) container = container.parentElement!;
      
      // Find the closest div or p to apply style to
      const block = container.closest('div, p') as HTMLElement;
      if (block && editorRef.current.contains(block)) {
        block.style[styleName as any] = value;
      }
      updateBody();
    }
  };

  const wrapInTag = (tagName: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const content = range.extractContents();
      const tag = document.createElement(tagName);
      tag.appendChild(content);
      range.insertNode(tag);
      updateBody();
    }
  };

  const toggleSourceMode = (targetMode: boolean) => {
    if (isSourceMode === targetMode) return;
    setIsSourceMode(targetMode);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSetting(GAS_URL_KEY, gasUrl);
    saveSetting(WHATSAPP_COUNTRY_CODE_KEY, whatsappCountryCode);
    setShowSettings(false);
    showNotify('Configuration saved', 'success');
  };

  const handleLinkClick = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setLinkDialog({ show: true, url: '', range });
    } else {
      showNotify('Please select some text first', 'info');
    }
  };

  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const { url, range } = linkDialog;
    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('createLink', false, url);
      updateBody();
    }
    setLinkDialog({ show: false, url: '', range: null });
  };

  const handleFile = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          data: base64Data.split(',')[1]
        }]);
      };
      reader.readAsDataURL(file);
    });
    showNotify(`${files.length} file(s) attached`, 'success');
  };

  const removeAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const formatWhatsAppPhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return '';
    
    // If number doesn't start with the current country code and is likely a local number
    // (Usually 9-11 digits without CC), prepend the country code.
    if (whatsappCountryCode && !cleaned.startsWith(whatsappCountryCode)) {
      // Check if it looks like it's missing a country code (e.g., 10 digits)
      if (cleaned.length <= 10) {
        cleaned = whatsappCountryCode + cleaned;
      }
    }
    return cleaned;
  };

  const handleGenerateWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    const isBulk = bulkActive && bulkData.length > 0;
    let targetIndices: number[] = [];

    if (isBulk) {
      if (mailCountMode === 'auto') targetIndices = bulkData.map((_, i) => i);
      else if (mailCountMode === 'fixed') {
        const start = Math.max(0, fixedMailRange.from - 1);
        const end = Math.min(bulkData.length, fixedMailRange.to);
        for (let i = start; i < end; i++) targetIndices.push(i);
      } else if (mailCountMode === 'manual') targetIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    } else {
      targetIndices = [0];
    }

    const newItems: WhatsAppItem[] = [];
    let currentId = 0;

    targetIndices.forEach((dataIndex) => {
      const row = isBulk ? bulkData[dataIndex] : {};
      const recipientTo = replaceVariables(to, row);
      
      // Split by comma in case of multiple numbers in one field
      const phones = recipientTo.split(',').map(p => p.trim()).filter(Boolean);
      
      phones.forEach(p => {
        let cleanedPhone = p.replace(/\D/g, '');
        if (!cleanedPhone) return;

        let itemCC = whatsappCountryCode;
        let finalPhone = cleanedPhone;

        // If the number already starts with our CC, separate it for the editable fields
        if (whatsappCountryCode && cleanedPhone.startsWith(whatsappCountryCode)) {
          finalPhone = cleanedPhone.substring(whatsappCountryCode.length);
        }
        // Otherwise, it stays as is and itemCC will be added during sending

        newItems.push({
          id: currentId++,
          cc: itemCC,
          phone: finalPhone,
          text: replaceVariables(body, row),
          sent: false
        });
      });
    });

    setGeneratedWhatsAppItems(newItems);
    setShowWhatsAppList(true);
    setShowBulk(false);
    setShowPreview(false);
    showNotify(`Generated ${newItems.length} WhatsApp messages`, 'success');
  };

  const updateWhatsAppItem = (id: number, field: keyof WhatsAppItem, value: any) => {
    setGeneratedWhatsAppItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const sendWhatsAppSingle = (item: WhatsAppItem) => {
    const fullPhone = item.cc + item.phone;
    const encodedText = encodeURIComponent(item.text);
    window.open(`https://wa.me/${fullPhone}?text=${encodedText}`, '_blank');
    setGeneratedWhatsAppItems(prev => prev.map(i => i.id === item.id ? { ...i, sent: true } : i));
  };

  const whatsappTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertWhatsAppFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = whatsappTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + prefix + selectedText + suffix + after;
    setBody(newText);

    // Re-focus and set selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const formatWhatsAppPreview = (text: string) => {
    return text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/~([^~]+)~/g, '<del>$1</del>')
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n/g, '<br />');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPlatform === 'gmail' && !gasUrl) {
      showNotify('GAS URL missing. Opening setup guide...', 'error');
      setShowHelp(true);
      return;
    }
    const isBulk = bulkActive && bulkData.length > 0;
    
    let targetIndices: number[] = [];

    if (isBulk) {
      if (mailCountMode === 'auto') {
        targetIndices = bulkData.map((_, i) => i);
      } else if (mailCountMode === 'fixed') {
        const start = Math.max(0, fixedMailRange.from - 1);
        const end = Math.min(bulkData.length, fixedMailRange.to);
        for (let i = start; i < end; i++) targetIndices.push(i);
      } else if (mailCountMode === 'manual') {
        targetIndices = Array.from(selectedIndices).sort((a, b) => a - b);
      }
    } else {
      targetIndices = [0]; // Dummy index for single mail
    }

    const sendCount = targetIndices.length;
    if (isBulk && sendCount <= 0) { showNotify('No recipients selected', 'error'); return; }
    
    setSending(true);
    if (isBulk) addLog(`Starting bulk send of ${sendCount} messages...`, 'info');

    try {
      for (let i = 0; i < targetIndices.length; i++) {
        const dataIndex = targetIndices[i];
        const row = isBulk ? bulkData[dataIndex] : {};
        const recipientTo = replaceVariables(to, row);
        
        const payload = {
          to: recipientTo.split(',').map(s => s.trim()).filter(Boolean),
          cc: replaceVariables(cc, row).split(',').map(s => s.trim()).filter(Boolean),
          bcc: replaceVariables(bcc, row).split(',').map(s => s.trim()).filter(Boolean),
          subject: replaceVariables(subject, row),
          body: replaceVariables(body, row),
          attachments
        };

        try {
          if (currentPlatform === 'gmail') {
            await fetch(gasUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          } else if (currentPlatform === 'whatsapp') {
            // Fallback to wa.me if no API provided (only for single send, not very useful for bulk)
            const phone = recipientTo.replace(/\D/g, '');
            const text = encodeURIComponent(payload.body.replace(/<[^>]*>/g, ''));
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
          }
          addLog(`Successfully sent to: ${recipientTo}`, 'success');
        } catch (err) {
          addLog(`Failed sending to: ${recipientTo} - ${String(err)}`, 'error');
        }

        if (isBulk && (i + 1) % 5 === 0) showNotify(`Sent ${i + 1}/${sendCount}...`, 'info');
      }
      showNotify(`Successfully processed ${sendCount} message(s)!`, 'success');
      if (!isBulk) { setTo(''); setCc(''); setBcc(''); setSubject(''); setBody(''); setAttachments([]); if (editorRef.current) editorRef.current.innerHTML = ''; }
    } catch (err) { 
      showNotify('Error in sending process', 'error'); 
      addLog(`Critical error in sending process: ${String(err)}`, 'error');
    } finally { 
      setSending(false); 
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotify('Code copied to clipboard', 'success');
  };

  const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  );

  return (
    <div className={`app-container ${showMobileSidebar ? 'mobile-sidebar-open' : ''}`}>
      <nav className={`sidebar ${showMobileSidebar ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="logo-icon" title="Dark Table Message">M</div>
          <div className="platform-switchers">
            <button className={`icon-btn platform-btn ${currentPlatform === 'gmail' ? 'active' : ''}`} onClick={() => { setCurrentPlatform('gmail'); setShowMobileSidebar(false); }} title="Gmail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </button>
            <button className={`icon-btn platform-btn ${currentPlatform === 'whatsapp' ? 'active' : ''}`} onClick={() => { setCurrentPlatform('whatsapp'); setShowMobileSidebar(false); }} title="WhatsApp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
            </button>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="icon-btn" onClick={() => { setShowHelp(true); setShowMobileSidebar(false); }} title="Help & Setup">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          <button className={`icon-btn ${showLogs ? 'active' : ''}`} onClick={() => { setShowLogs(true); setShowMobileSidebar(false); }} title="Live Logs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button className="icon-btn" onClick={() => { setShowSettings(true); setShowMobileSidebar(false); }} title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </nav>

      {showMobileSidebar && <div className="sidebar-overlay" onClick={() => setShowMobileSidebar(false)} />}

      <main className={`main-content ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files); }}
      >
        <header className="main-header">
          <div className="header-left">
            <button className="hamburger-btn" onClick={() => setShowMobileSidebar(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="header-title">Dark Table Message</div>
          </div>
          <div className="header-actions">
            {currentPlatform === 'whatsapp' && generatedWhatsAppItems.length > 0 && (
              <button className={`preview-toggle-btn ${showWhatsAppList ? 'active' : ''}`} onClick={() => { setShowWhatsAppList(!showWhatsAppList); setShowBulk(false); setShowPreview(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <span>Queue</span>
              </button>
            )}
            <button className={`preview-toggle-btn ${showBulk ? 'active' : ''}`} onClick={() => { setShowBulk(!showBulk); setShowPreview(false); setShowWhatsAppList(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Bulk</span>
            </button>
            <button className={`preview-toggle-btn ${showPreview ? 'active' : ''}`} onClick={() => { setShowPreview(!showPreview); setShowBulk(false); setShowWhatsAppList(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Preview</span>
            </button>
            <button className="send-btn" onClick={currentPlatform === 'whatsapp' ? handleGenerateWhatsApp : handleSend} disabled={sending}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale" style={{ marginRight: '8px' }}><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <span>{sending ? 'Sending...' : (currentPlatform === 'whatsapp' ? 'Generate' : 'Send')}</span>
            </button>
          </div>
        </header>

        <div className="editor-preview-layout">
          <form className="compose-form" onSubmit={currentPlatform === 'whatsapp' ? handleGenerateWhatsApp : handleSend}>
              <div className="form-fields">
                {currentPlatform === 'whatsapp' ? (
                  <div className="input-row">
                    <label>Phone</label>
                    <div className="phone-input-group">
                      <input 
                        type="text" 
                        className="country-code-input"
                        placeholder="CC" 
                        value={whatsappCountryCode} 
                        onChange={e => setWhatsappCountryCode(e.target.value.replace(/\D/g, ''))} 
                        title="Country Code"
                      />
                      <input 
                        type="text" 
                        placeholder="Phone numbers, {phone_col}" 
                        value={to} 
                        onChange={e => setTo(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="input-row">
                    <label>To</label>
                    <input 
                      type="text" 
                      placeholder="user1@example.com, {email_col}" 
                      value={to} 
                      onChange={e => setTo(e.target.value)} 
                      required 
                    />
                  </div>
                )}
                {currentPlatform !== 'whatsapp' && (
                  <>
                    <div className="input-row"><label>Cc</label><input type="text" placeholder="cc1@example.com, {cc_col}" value={cc} onChange={e => setCc(e.target.value)} /></div>
                    <div className="input-row"><label>Bcc</label><input type="text" placeholder="bcc1@example.com, {bcc_col}" value={bcc} onChange={e => setBcc(e.target.value)} /></div>
                    <div className="input-row"><label>Subject</label><input type="text" placeholder="Subject {name}" value={subject} onChange={e => setSubject(e.target.value)} required /></div>
                  </>
                )}
              </div>

              <div className="editor-container">
                {currentPlatform !== 'whatsapp' ? (
                  <>
                    <div className="formatting-toolbar">
                      <div className="mode-toggle">
                        <button type="button" className={!isSourceMode ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); toggleSourceMode(false); }} title="Text Mode">Text</button>
                        <button type="button" className={isSourceMode ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); toggleSourceMode(true); }} title="HTML Mode">HTML</button>
                      </div>
                      <div className="toolbar-divider"></div>
                      {!isSourceMode && (
                        <div className="toolbar-actions">
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }} title="Bold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }} title="Italic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }} title="Underline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('strikeThrough'); }} title="Strikethrough"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4C9.5 4 8 6 8 6"/><path d="M8 18C8 18 9.5 20 12 20C14.5 20 16 18 16 18"/></svg></button>
                          <div className="toolbar-divider"></div>
                          <div className="toolbar-select-wrapper font-family-select"><select onChange={(e) => execCmd('fontName', e.target.value)} defaultValue="JetBrains Mono" title="Font Family">
                            <option value="JetBrains Mono">JetBrains Mono</option><option value="Inter">Inter</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option>
                          </select></div>
                          <div className="toolbar-select-wrapper"><select onChange={(e) => execCmd('fontSize', e.target.value)} defaultValue="3" title="Font Size">
                            <option value="1">X-Small</option>
                            <option value="2">Small</option>
                            <option value="3">Normal</option>
                            <option value="4">Medium</option>
                            <option value="5">Large</option>
                            <option value="6">X-Large</option>
                            <option value="7">Huge</option>
                          </select></div>
                          <div className="color-picker-wrapper" title="Text Color"><input type="color" onInput={(e) => { execCmd('foreColor', e.currentTarget.value); e.currentTarget.value = '#ffffff'; }} defaultValue="#ffffff" /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="m19 21-7-7-7 7"/><path d="M12 14V3"/></svg></div>
                          <div className="toolbar-divider"></div>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyLeft'); }} title="Align Left"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyCenter'); }} title="Align Center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyRight'); }} title="Align Right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg></button>
                          <div className="toolbar-divider"></div>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} title="Bullet List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }} title="Numbered List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="10" cy="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg></button>
                          <div className="toolbar-divider"></div>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'blockquote'); }} title="Block Quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('fontName', 'JetBrains Mono'); }} title="Monospace"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); wrapInTag('code'); }} title="Inline Code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg></button>
                          <div className="toolbar-divider"></div>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('outdent'); }} title="Decrease Indent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><polyline points="7 8 3 12 7 16"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="18" x2="11" y2="18"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('indent'); }} title="Increase Indent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><polyline points="17 8 21 12 17 16"/><line x1="3" y1="12" x2="13" y2="12"/><line x1="3" y1="6" x2="13" y2="6"/><line x1="3" y1="18" x2="13" y2="18"/></svg></button>
                          <div className="toolbar-divider"></div>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleLinkClick(); }} title="Insert Link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('removeFormat'); }} title="Clear Formatting"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/><path d="M4 20h16"/></svg></button>
                        </div>
                      )}

                    </div>
                    {!isSourceMode ? (
                      <div className="rich-editor" contentEditable={true} ref={editorRef} onInput={updateBody} onBlur={updateBody} data-placeholder="Start typing..." />
                    ) : (
                      <textarea className="source-editor" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Enter raw HTML here..." />
                    )}
                  </>
                ) : (
                  <div className="whatsapp-editor-wrapper">
                    <div className="formatting-toolbar whatsapp-toolbar">
                      <div className="toolbar-actions">
                        <button type="button" onClick={() => insertWhatsAppFormatting('*')} title="Bold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg></button>
                        <button type="button" onClick={() => insertWhatsAppFormatting('_')} title="Italic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg></button>
                        <button type="button" onClick={() => insertWhatsAppFormatting('~')} title="Strikethrough"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4C9.5 4 8 6 8 6"/><path d="M8 18C8 18 9.5 20 12 20C14.5 20 16 18 16 18"/></svg></button>
                        <button type="button" onClick={() => insertWhatsAppFormatting('```')} title="Monospace"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>
                        <button type="button" onClick={() => insertWhatsAppFormatting('`')} title="Inline Code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg></button>
                        <button type="button" onClick={() => insertWhatsAppFormatting('> ')} title="Block Quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
                      </div>
                    </div>
                    <textarea 
                      className="whatsapp-editor" 
                      ref={whatsappTextareaRef}
                      value={body} 
                      onChange={(e) => setBody(e.target.value)} 
                      placeholder="Type your WhatsApp message... Use toolbar for formatting" 
                    />
                  </div>
                )}
              </div>

              {currentPlatform !== 'whatsapp' && (
                <div 
                  className={`attachment-box ${isDragging ? 'dragging' : ''}`} 
                  onClick={() => attachmentInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    multiple 
                    ref={attachmentInputRef} 
                    style={{ display: 'none' }} 
                    onChange={(e) => { handleFile(e.target.files); e.target.value = ''; }} 
                  />
                  {attachments.length === 0 ? (
                    <div className="attachment-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>Click or drag and drop files here to attach</span>
                    </div>
                  ) : (
                    <div className="attachment-grid">
                      {attachments.map((file, index) => (
                        <div key={index} className="attachment-chip" onClick={(e) => e.stopPropagation()}>
                          <span className="file-name">{file.name}</span>
                          <button type="button" className="remove-btn" onClick={(e) => { e.stopPropagation(); removeAttachment(index); }}>&times;</button>
                        </div>
                      ))}
                      <div className="add-more" onClick={(e) => { e.stopPropagation(); attachmentInputRef.current?.click(); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

          {(showPreview || showBulk || showWhatsAppList) && (
              <>
                <div className={`resizer-handle ${isResizing ? 'active' : ''}`} onMouseDown={startResizing} />
                <aside className="preview-panel" style={{ width: `${sidePanelWidth}px` }}>
                  {currentPlatform === 'whatsapp' && showWhatsAppList ? (
                    <>
                      <div className="preview-header">
                        <span>WhatsApp Queue</span>
                        <div style={{ display: 'flex', gap: '0.5em' }}>
                          <button className="secondary-btn small" onClick={() => { setGeneratedWhatsAppItems([]); setShowWhatsAppList(false); }}>Clear</button>
                          <button className="close-btn" onClick={() => setShowWhatsAppList(false)}><CloseIcon /></button>
                        </div>
                      </div>
                      <div className="whatsapp-list-container">
                        {generatedWhatsAppItems.length === 0 ? (
                          <div className="logs-empty">No messages generated yet. Click "Generate" to start.</div>
                        ) : (
                          <div className="whatsapp-items-list">
                            {generatedWhatsAppItems.map((item) => (
                              <div key={item.id} className={`whatsapp-item ${item.sent ? 'sent' : ''}`}>
                                <div className="whatsapp-item-info">
                                  <div className="whatsapp-item-edit-group">
                                    <input 
                                      className="item-cc-input" 
                                      value={item.cc} 
                                      onChange={e => updateWhatsAppItem(item.id, 'cc', e.target.value.replace(/\D/g, ''))} 
                                    />
                                    <input 
                                      className="item-phone-input" 
                                      value={item.phone} 
                                      onChange={e => updateWhatsAppItem(item.id, 'phone', e.target.value.replace(/\D/g, ''))} 
                                    />
                                  </div>
                                  <span className="text-preview">{item.text.substring(0, 60)}...</span>
                                </div>
                                <button className="send-single-btn" onClick={() => sendWhatsAppSingle(item)}>
                                  {item.sent ? 'Resend' : 'Send'}
                                </button>
                              </div>
                            ))}
                          </div>

                        )}
                      </div>
                    </>
                  ) : showPreview ? (
                    <>
                      <div className="preview-header">
                        <span>Live Preview</span>
                        <button className="close-btn" onClick={() => setShowPreview(false)}><CloseIcon /></button>
                      </div>
                      <div className="preview-body">
                        <div className="preview-paper">
                          <div className="preview-metadata">
                            {currentPlatform === 'gmail' && <div><strong>Subject:</strong> {subject || '(No Subject)'}</div>}
                            <div><strong>To:</strong> {to || '(No Recipient)'}</div>
                          </div>
                          <hr className="preview-divider" />
                          <div 
                            className="preview-content" 
                            dangerouslySetInnerHTML={{ 
                              __html: currentPlatform === 'whatsapp' ? formatWhatsAppPreview(body) : (body || '...') 
                            }} 
                          />
                        </div>
                      </div>
                    </>

                  ) : (
                    <>
                      <div className="preview-header">
                        <span>Bulk Configuration</span>
                        <button className="close-btn" onClick={() => setShowBulk(false)}><CloseIcon /></button>
                      </div>
                        <div className="bulk-panel-body">
                          <div className="bulk-section">
                            <div className="bulk-toggle-inline" onClick={() => setBulkActive(!bulkActive)}>
                              <div className="checkbox-wrapper">
                                <div className={`checkbox ${bulkActive ? 'checked' : ''}`} />
                              </div>
                              <label>Enable Bulk Mode</label>
                              </div>

                          </div>
                          <div className={`bulk-section ${!bulkActive ? 'disabled' : ''}`}>
                            <div className="bulk-section-header">
                              <label>Data Source</label>
                              {bulkFile && <span className="bulk-badge">{bulkData.length} Records</span>}
                            </div>
                            <div className={`bulk-drop-zone ${bulkFile ? 'has-file' : ''}`} onClick={() => bulkFileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }} onDragLeave={(e) => e.currentTarget.classList.remove('dragging')} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragging'); if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); }}>
                              <input type="file" ref={bulkFileInputRef} accept=".csv,.xlsx,.xls" onChange={(e) => { if (e.target.files?.[0]) { processFile(e.target.files[0]); e.target.value = ''; } }} style={{ display: 'none' }} />
                              {bulkFile ? (
                                <div className="file-info">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="no-scale"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  <div className="text"><span className="name">{bulkFile.name}</span></div>
                                  <button className="secondary-btn small" onClick={(e) => { e.stopPropagation(); setBulkFile(null); setBulkData([]); }}>Change</button>
                                </div>
                              ) : (
                                <div className="upload-prompt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="no-scale"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Click or drag CSV/Excel file</span></div>
                              )}
                            </div>
                          </div>
                          {bulkColumns.length > 0 && detectedVariables.length > 0 && (
                            <div className={`bulk-section ${!bulkActive ? 'disabled' : ''}`}>
                              <label>Variable Mapping</label>
                              <div className="mapping-container">
                                {detectedVariables.map(v => (
                                  <div className="mapping-item" key={v}>
                                    <div className="var-label"><code>{`{${v}}`}</code></div>
                                    <div className="mapping-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="no-scale"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
                                    <select className="col-select" value={variableMapping[v] || ''} onChange={e => setBulkMapping(prev => ({ ...prev, [v]: e.target.value }))}>
                                      <option value="">Select Column...</option>
                                      {bulkColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className={`bulk-section ${!bulkActive ? 'disabled' : ''}`}>
                            <label>Mailing Strategy</label>
                            <div className="count-control">
                              <div className="mode-toggle">
                                <button type="button" className={mailCountMode === 'auto' ? 'active' : ''} onClick={() => setMailCountMode('auto')}>Auto</button>
                                <button type="button" className={mailCountMode === 'fixed' ? 'active' : ''} onClick={() => setMailCountMode('fixed')}>Range</button>
                                <button type="button" className={mailCountMode === 'manual' ? 'active' : ''} onClick={() => setMailCountMode('manual')}>Selective</button>
                              </div>
                              {mailCountMode === 'fixed' && (
                                <div className="range-inputs">
                                  <div className="fixed-input-wrapper">
                                    <span className="label">From</span>
                                    <input type="number" value={fixedMailRange.from} onChange={e => setFixedMailRange(prev => ({ ...prev, from: parseInt(e.target.value) || 1 }))} min="1" max={bulkData.length} />
                                  </div>
                                  <div className="fixed-input-wrapper">
                                    <span className="label">To</span>
                                    <input type="number" value={fixedMailRange.to} onChange={e => setFixedMailRange(prev => ({ ...prev, to: parseInt(e.target.value) || 1 }))} min="1" max={bulkData.length} />
                                  </div>
                                </div>
                              )}
                              {mailCountMode === 'manual' && (
                                <div className="manual-selection-container">
                                  <div className="manual-header">
                                    <div className="search-box">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="no-scale"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                      <input type="text" placeholder="Search records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                    </div>
                                    <button type="button" className="select-all-btn" onClick={toggleAll}>
                                      {selectedIndices.size === bulkData.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                  </div>
                                  <div className="row-list">
                                    {bulkData.map((row, i) => {
                                      const rowText = Object.values(row).join(' ').toLowerCase();
                                      if (searchTerm && !rowText.includes(searchTerm.toLowerCase())) return null;
                                      return (
                                        <div key={i} className={`selectable-row ${selectedIndices.has(i) ? 'selected' : ''}`} onClick={() => toggleIndex(i)}>
                                          <div className="checkbox-wrapper">
                                            <div className={`checkbox ${selectedIndices.has(i) ? 'checked' : ''}`} />
                                          </div>
                                          <div className="row-preview">
                                            {Object.values(row).slice(0, 3).map((val: any, idx) => (
                                              <span key={idx} className="cell-preview">{String(val)}</span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            <p className="hint">
                              {mailCountMode === 'auto' && `Will send to all ${bulkData.length} records.`}
                              {mailCountMode === 'fixed' && `Will send records ${fixedMailRange.from} to ${fixedMailRange.to} (${Math.max(0, fixedMailRange.to - fixedMailRange.from + 1)} total).`}
                              {mailCountMode === 'manual' && `${selectedIndices.size} of ${bulkData.length} records selected.`}
                            </p>
                          </div>
                        </div>
                    </>
                  )}
                </aside>
              </>
            )}
        </div>
      </main>

      {notification && (<div className={`notification-toast ${notification.type}`}>{notification.message}</div>)}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={handleSaveSettings}>
            <div className="modal-header">
              <h3>System Settings</h3>
              <button type="button" className="close-btn" onClick={() => setShowSettings(false)}><CloseIcon /></button>
            </div>
            <div className="settings-panel-body">
              <section className="settings-section">
                <label>Backend Integrations</label>
                <div className="settings-grid">
                  <div className="setting-sub-section">
                    <span className="sub-label">Gmail (GAS)</span>
                    <input type="url" placeholder="GAS Deployment URL" value={gasUrl} onChange={e => setGasUrl(e.target.value)} />
                  </div>
                  <div className="setting-sub-section">
                    <span className="sub-label">WhatsApp Integration</span>
                    <input type="text" placeholder="Default Country Code (e.g. 92)" value={whatsappCountryCode} onChange={e => setWhatsappCountryCode(e.target.value)} />
                  </div>
                </div>
              </section>
              <section className="settings-section">
                <label>Appearance</label>
                <div className="settings-grid">
                  <div className="setting-item"><span>Theme</span><select value={theme} onChange={e => setTheme(e.target.value)}><option value="dark">Pure Black</option><option value="off-white">Off-white</option><option value="one-dark">One Dark</option><option value="github-light">GitHub Light</option></select></div>
                  <div className="setting-item"><span>UI Font</span><select value={uiFont} onChange={e => setUiFont(e.target.value)}><option value="Inter">Inter</option><option value="Roboto">Roboto</option><option value="JetBrains Mono">JetBrains Mono</option><option value="Open Sans">Open Sans</option></select></div>
                  <div className="setting-item"><span>UI Size</span><div className="range-control"><input type="range" min="11" max="18" value={uiFontSize} onChange={e => setUiFontSize(parseInt(e.target.value))} /></div></div>
                </div>
              </section>
            </div>
            <div className="modal-actions"><button type="submit" className="primary-btn">Done</button></div>
          </form>
        </div>
      )}

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Setup Guide & Backend Code</h3>
              <button className="close-btn" onClick={() => setShowHelp(false)}><CloseIcon /></button>
            </div>
            <div className="help-tabs">
              <button className={`help-tab-btn ${helpTab === 'gmail' ? 'active' : ''}`} onClick={() => setHelpTab('gmail')}>Gmail</button>
              <button className={`help-tab-btn ${helpTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setHelpTab('whatsapp')}>WhatsApp</button>
            </div>
            <div className="help-panel-body">
              {helpTab === 'gmail' && (
                <section className="help-section">
                  <label>Gmail / Google Apps Script</label>
                  <p className="hint">Create a new script at script.google.com and paste the following code:</p>
                  <div className="code-block-container">
                    <pre><code>{gasCode}</code></pre>
                    <button className="copy-btn" onClick={() => copyToClipboard(gasCode)}>Copy Code</button>
                  </div>
                  <div style={{ marginTop: '1.5em' }}>
                    <label>Deployment Steps</label>
                    <ol className="help-list">
                      <li>Click <strong>Deploy</strong> &gt; <strong>New deployment</strong></li>
                      <li>Select type: <strong>Web App</strong></li>
                      <li>Set 'Execute as' to <strong>Me</strong></li>
                      <li>Set 'Who has access' to <strong>Anyone</strong></li>
                      <li>Copy the <strong>Web App URL</strong> and paste it into Settings.</li>
                    </ol>
                  </div>
                </section>
              )}
              {helpTab === 'whatsapp' && (
                <section className="help-section">
                  <label>WhatsApp Integration</label>
                  <ul className="help-list">
                    <li>WhatsApp messages are sent via <strong>wa.me</strong> links.</li>
                    <li>Clicking "Generate" will create a list of links in the side panel.</li>
                    <li>You can then click "Send" next to each item to open WhatsApp with the message pre-filled.</li>
                    <li>Configure a <strong>Default Country Code</strong> in Settings to automatically format local numbers.</li>
                  </ul>
                </section>
              )}
              <section className="help-section" style={{ marginTop: '1em', borderTop: '1px solid var(--border)', paddingTop: '1em' }}>
                <label>General Usage (Variables)</label>
                <ul className="help-list">
                  <li>Use curly braces for placeholders, e.g., <code>{"{name}"}</code> or <code>{"{company}"}</code></li>
                  <li>Upload a CSV/Excel file, then map detected variables to sheet columns in the <strong>Bulk Send</strong> panel.</li>
                </ul>
              </section>
            </div>
            <div className="modal-actions"><button className="primary-btn" onClick={() => setShowHelp(false)}>Got it</button></div>
          </div>
        </div>
      )}

      {linkDialog.show && (
        <div className="modal-overlay" onClick={() => setLinkDialog({ show: false, url: '', range: null })}><div className="modal-content small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Insert Link</h3><button className="close-btn" onClick={() => setLinkDialog({ show: false, url: '', range: null })}><CloseIcon /></button></div>
            <form onSubmit={applyLink}><div className="settings-group"><label>URL</label><div className="url-input-container"><input type="url" value={linkDialog.url} onChange={e => setLinkDialog(prev => ({ ...prev, url: e.target.value }))} required autoFocus /></div></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setLinkDialog({ show: false, url: '', range: null })}>Cancel</button><button type="submit" className="primary-btn">Insert</button></div></form>
          </div></div>
      )}
      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Live Sending Logs</h3>
              <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
                <button className="secondary-btn small" onClick={() => setLogs([])} style={{ padding: '0.3em 0.8em', fontSize: '0.8em' }}>Clear</button>
                <button className="close-btn" onClick={() => setShowLogs(false)}><CloseIcon /></button>
              </div>
            </div>
            <div className="logs-container">
              {logs.length === 0 ? (
                <div className="logs-empty">No logs yet. Logs will appear here when you start sending emails.</div>
              ) : (
                <div className="logs-list">
                  {logs.map((log, i) => (
                    <div key={i} className={`log-item ${log.type}`}>
                      <span className="log-time">[{log.timestamp}]</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="primary-btn" onClick={() => setShowLogs(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
