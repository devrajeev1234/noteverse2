import React, { useEffect, useMemo, useState } from 'react';
import Tesseract from 'tesseract.js';

export default function Notes({ apiBase, idToken, profile, onLogout }) {
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }), [idToken]);
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'notes'

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const url = new URL(`${apiBase}/notes`);
      if (q) url.searchParams.set('q', q);
      if (tagFilter) url.searchParams.set('tag', tagFilter);
      
      let res;
      try {
        res = await fetch(url, { headers });
      } catch (networkErr) {
        // Network error - don't clear token, just show error
        console.error('Network error:', networkErr);
        setError('Cannot connect to server. Make sure the server is running.');
        setLoading(false);
        return;
      }
      
      if (!res.ok) {
        if (res.status === 401) {
          // Only clear token on actual 401 authentication error
          // But first, try to get error details to see if it's a real auth failure
          let errorData = { error: 'Unauthorized' };
          try {
            errorData = await res.clone().json();
          } catch {
            // Couldn't parse error response
          }
          console.error('Token rejected by server (401):', errorData);
          
          // Only log out if it's a clear authentication error, not a network/server issue
          if (errorData.error && (errorData.error.includes('token') || errorData.error.includes('Unauthorized') || errorData.error.includes('Missing'))) {
            console.log('Confirmed auth failure, clearing session');
            localStorage.removeItem('noterverse_idToken');
            localStorage.removeItem('noterverse_profile');
            if (onLogout) onLogout();
            throw new Error('Session expired. Please sign in again.');
          } else {
            // Might be a server issue, don't log out
            console.warn('401 error but not clear auth failure, keeping session');
            throw new Error(`Server error: ${errorData.error || res.statusText}`);
          }
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setNotes(data || []);
      
      // Try to load tags, but don't fail if it errors
      try {
        const tRes = await fetch(`${apiBase}/notes/tags/list`, { headers });
        if (tRes.ok) {
          const tagsData = await tRes.json();
          setAllTags(tagsData || []);
        }
      } catch (tagsErr) {
        console.warn('Failed to load tags:', tagsErr);
        // Don't fail the whole load if tags fail
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      // Only set error if it's not a 401 (which triggers logout)
      if (err.message !== 'Session expired. Please sign in again.') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (idToken && headers) {
      // Add a small delay to ensure token is fully set
      const timer = setTimeout(() => {
        load();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [q, tagFilter, idToken, headers]);

  // Reload notes when switching to notes tab
  useEffect(() => {
    if (activeTab === 'notes' && idToken && headers) {
      load();
    }
  }, [activeTab]);

  async function createNote() {
    if (!title.trim() && !content.trim()) {
      alert('Please add a title or content to your note');
      return;
    }
    try {
      const body = { title, content, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) };
      const res = await fetch(`${apiBase}/notes`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('noterverse_idToken');
          localStorage.removeItem('noterverse_profile');
          if (onLogout) onLogout();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(`Failed to create note: ${res.statusText}`);
      }
      setTitle(''); setContent(''); setTags('');
      await load();
      // Switch to notes tab to show the new note
      setActiveTab('notes');
    } catch (err) {
      console.error('Error creating note:', err);
      alert('Failed to create note: ' + err.message);
    }
  }

  async function handleOCR(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await Tesseract.recognize(file, 'eng');
      setContent((prev) => (prev ? prev + '\n' : '') + data.text.trim());
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e2e8f0', 
        padding: '20px 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Noterverse
            </h1>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Signed in as {profile?.name || profile?.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {activeTab === 'notes' && (
              <>
                <input 
                  placeholder="🔍 Search notes..." 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)}
                  style={{ 
                    padding: '10px 16px', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: 8, 
                    fontSize: 14,
                    width: 250,
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                <select 
                  value={tagFilter} 
                  onChange={(e) => setTagFilter(e.target.value)}
                  style={{ 
                    padding: '10px 16px', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: 8, 
                    fontSize: 14,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">All tags</option>
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )}
            {onLogout && (
              <button 
                onClick={onLogout}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 8, 
                  fontSize: 14, 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 32,
          borderBottom: '2px solid #e2e8f0'
        }}>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              fontSize: 16,
              fontWeight: activeTab === 'create' ? 600 : 500,
              color: activeTab === 'create' ? '#667eea' : '#64748b',
              cursor: 'pointer',
              borderBottom: activeTab === 'create' ? '3px solid #667eea' : '3px solid transparent',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            ✏️ Create Note
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              fontSize: 16,
              fontWeight: activeTab === 'notes' ? 600 : 500,
              color: activeTab === 'notes' ? '#667eea' : '#64748b',
              cursor: 'pointer',
              borderBottom: activeTab === 'notes' ? '3px solid #667eea' : '3px solid transparent',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📚 My Notes
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: 16, 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fca5a5', 
            borderRadius: 12, 
            marginBottom: 24, 
            color: '#991b1b' 
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Create Note Tab */}
        {activeTab === 'create' && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: 32, 
            borderRadius: 16, 
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
            border: '1px solid #e2e8f0'
          }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>
              Create New Note
            </h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <input 
                placeholder="Note title..." 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                style={{ 
                  padding: '14px 16px', 
                  border: '2px solid #e2e8f0', 
                  borderRadius: 12, 
                  fontSize: 16,
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <textarea 
                placeholder="Write your note here..." 
                rows={12} 
                value={content} 
                onChange={(e) => setContent(e.target.value)}
                style={{ 
                  padding: '16px', 
                  border: '2px solid #e2e8f0', 
                  borderRadius: 12, 
                  fontSize: 15, 
                  fontFamily: 'inherit', 
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'all 0.2s',
                  lineHeight: 1.6
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input 
                  placeholder="Tags (comma separated)" 
                  value={tags} 
                  onChange={(e) => setTags(e.target.value)}
                  style={{ 
                    flex: 1, 
                    minWidth: 200, 
                    padding: '12px 16px', 
                    border: '2px solid #e2e8f0', 
                    borderRadius: 12, 
                    fontSize: 14,
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
                <label style={{ 
                  border: '2px solid #667eea', 
                  color: '#667eea', 
                  padding: '12px 20px', 
                  borderRadius: 12, 
                  cursor: 'pointer', 
                  fontSize: 14, 
                  fontWeight: 600,
                  backgroundColor: '#f8fafc',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#667eea';
                  e.target.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#f8fafc';
                  e.target.style.color = '#667eea';
                }}
                >
                  {uploading ? '⏳ Processing OCR...' : '📷 OCR from image'}
                  <input type="file" accept="image/*" onChange={handleOCR} style={{ display: 'none' }} disabled={uploading} />
                </label>
                <button 
                  onClick={createNote}
                  style={{ 
                    padding: '12px 32px', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 12, 
                    fontSize: 15, 
                    fontWeight: 600, 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  💾 Save Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            {loading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 60, 
                color: '#64748b',
                backgroundColor: 'white',
                borderRadius: 16,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 16 }}>Loading notes...</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 20 }}>
                {notes.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 60, 
                    backgroundColor: 'white', 
                    borderRadius: 16, 
                    color: '#64748b',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                    <p style={{ fontSize: 20, marginBottom: 8, fontWeight: 600, color: '#475569' }}>No notes yet</p>
                    <p style={{ fontSize: 15 }}>Create your first note in the "Create Note" tab!</p>
                  </div>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} style={{ 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 16, 
                      padding: 24, 
                      backgroundColor: 'white', 
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      borderLeft: '4px solid #667eea'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1e293b' }}>
                          {n.title || '(Untitled)'}
                        </h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {n.tags.map((t) => (
                            <span key={t} style={{ 
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white', 
                              padding: '6px 12px', 
                              borderRadius: 20, 
                              fontSize: 12, 
                              fontWeight: 600,
                              boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                            }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ 
                        whiteSpace: 'pre-wrap', 
                        color: '#475569', 
                        fontSize: 15, 
                        lineHeight: 1.7, 
                        fontFamily: 'inherit',
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0'
                      }}>
                        {n.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


