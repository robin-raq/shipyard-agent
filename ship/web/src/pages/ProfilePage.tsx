import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { getProfile, updateProfile, UserProfile } from '../api/client';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
    phone: '',
    location: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getProfile();
        setProfile(data);
        setForm({
          displayName: data.displayName || '',
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || '',
          phone: data.phone || '',
          location: data.location || '',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onCancel = () => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName || '',
      bio: profile.bio || '',
      avatarUrl: profile.avatarUrl || '',
      phone: profile.phone || '',
      location: profile.location || '',
    });
    setIsEditing(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateProfile({
        displayName: form.displayName,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        phone: form.phone,
        location: form.location,
      });
      setProfile(updated);
      setIsEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update profile');
    }
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  if (loading) {
    return (
      <main className="p-8">
        <div className="text-gray-700" role="status" aria-live="polite">Loading...</div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error || 'Profile not found'}
        </div>
      </main>
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Edit Profile' : 'Profile'}</h1>
          {!isEditing && (
            <p className="text-sm text-gray-600 mt-1">Manage your personal information</p>
          )}
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit as any}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save Changes
            </button>
          </div>
        )}
      </header>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        {!isEditing ? (
          <div className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt={`${displayName} avatar`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-gray-600">{initials(displayName)}</span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900">{displayName}</h2>
                <p className="text-sm text-gray-600">@{profile.username}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-700">
                  {profile.title && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100">{profile.title}</span>}
                  {profile.department && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100">{profile.department}</span>}
                  {profile.role && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100">{profile.role}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Email</h3>
                <p className="text-gray-900">{profile.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Phone</h3>
                <p className="text-gray-900">{profile.phone || '—'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Location</h3>
                <p className="text-gray-900">{profile.location || '—'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Joined</h3>
                <p className="text-gray-900">{new Date(profile.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Bio</h3>
              <p className="text-gray-900 whitespace-pre-line">{profile.bio || 'No bio yet.'}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {form.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatarUrl} alt={`${form.displayName || profile.username} avatar preview`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-gray-600">{initials(form.displayName || profile.username)}</span>
                )}
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="displayName">Display name</label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={form.displayName}
                    onChange={onChange}
                    className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="avatarUrl">Avatar URL</label>
                  <input
                    id="avatarUrl"
                    name="avatarUrl"
                    type="url"
                    value={form.avatarUrl}
                    onChange={onChange}
                    className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="https://example.com/avatar.png"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={onChange}
                    className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="location">Location</label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    value={form.location}
                    onChange={onChange}
                    className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="City, Country"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="bio">Bio</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={form.bio}
                    onChange={onChange}
                    rows={5}
                    className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Tell others a bit about you"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
