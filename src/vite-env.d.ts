/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "@/pages/ProfileSettings" {
	const ProfileSettings: any;
	export default ProfileSettings;
}

declare module "@/pages/ProfileSettingsPage" {
	const ProfileSettingsPage: any;
	export default ProfileSettingsPage;
}
