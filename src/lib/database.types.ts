export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PathologyCode = 'flexor' | 'extensor' | 'otros';
export type TargetFinger = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' | 'all';
export type TrackedJoint = 'wrist' | 'MCP' | 'PIP' | 'DIP';
export type QualityFlag = 'clean' | 'low_visibility' | 'low_confidence' | 'partial';

export interface Database {
  public: {
    Tables: {
      doctors: {
        Row: {
          id: string;
          external_label: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          external_label: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['doctors']['Insert']>;
      };

      exercises: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          animation_url: string | null;
          tracked_joints: TrackedJoint[];
          target_finger: TargetFinger;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['exercises']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>;
      };

      patients: {
        Row: {
          id: string;
          doctor_id: string;
          external_id: string;
          pathology_code: PathologyCode | null;
          access_token: string;
          started_at: string;
          discharged_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          external_id: string;
          pathology_code?: PathologyCode | null;
          access_token?: string;
          started_at?: string;
          discharged_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['patients']['Insert']>;
      };

      prescriptions: {
        Row: {
          id: string;
          patient_id: string;
          exercise_id: string;
          sets: number;
          reps_per_set: number;
          sessions_per_day: number;
          duration_days: number;
          starts_on: string;
          replaces_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['prescriptions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['prescriptions']['Insert']>;
      };

      sessions: {
        Row: {
          id: string;
          patient_id: string;
          prescription_id: string;
          started_at: string;
          ended_at: string | null;
          reps_completed: number;
          target_reps: number;
          completion_pct: number;
          client_metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          prescription_id: string;
          started_at?: string;
          ended_at?: string | null;
          reps_completed?: number;
          target_reps: number;
          client_metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
      };

      rep_measurements: {
        Row: {
          id: string;
          session_id: string;
          rep_index: number;
          joint: string;
          max_flexion_deg: number | null;
          max_extension_deg: number | null;
          quality_flag: QualityFlag | null;
          recorded_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rep_measurements']['Row'], 'id' | 'recorded_at'> & {
          id?: string;
          recorded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rep_measurements']['Insert']>;
      };
    };

    Views: {
      patient_adherence: {
        Row: {
          patient_id: string;
          doctor_id: string;
          completed_sessions: number;
          expected_sessions: number;
          adherence_pct: number;
        };
      };
      // B-13: total + 7d adherence breakdown.
      patient_adherence_breakdown: {
        Row: {
          patient_id: string;
          doctor_id: string;
          total_completed: number;
          total_target: number;
          total_pct: number;
          week_completed: number | null;
          week_target: number | null;
          week_pct: number | null;
        };
      };
    };

    Functions: {
      // B-13
      patient_adherence_window: {
        Args: { window_days: number };
        Returns: {
          patient_id: string;
          sessions_completed: number;
          sessions_target: number;
          adherence_pct: number;
        }[];
      };
      // B-14
      patient_progression: {
        Args: {
          p_patient_id: string;
          p_from: string;
          p_to: string;
          p_joints: string[] | null;
        };
        Returns: {
          day: string;
          joint: string;
          max_flexion: number | null;
          max_extension: number | null;
          samples: number;
        }[];
      };
      // B-18
      stale_patients: {
        Args: {
          p_doctor_id: string;
          p_threshold_hours: number;
        };
        Returns: {
          patient_id: string;
          external_id: string;
          pathology_code: string | null;
          last_session_at: string | null;
          hours_since_last: number;
          has_ever_session: boolean;
        }[];
      };
    };
  };
}
